import type { AdminProduct, StoredOrder } from "@/lib/admin/types"
import { isProductVisibleInShop } from "@/lib/admin/product-status"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import { NEUTRAL_PRODUCT_PLACEHOLDER } from "@/lib/dripforge/neutral-placeholder"
import { normalizeTopProductsCount } from "@/lib/dripforge/top-products-settings"

/** Bekannte Seed-/Demo-Namen aus dem alten Katalog — nie auf der Homepage. */
const LEGACY_DEMO_PRODUCT_NAMES = new Set(
  [
    "Geometrischer Handyhalter",
    "Desktop Kabelhalter",
    "Kopfhoererhalter",
    "Kopfhörerhalter",
    "Sukkulenten Pflanztopf",
    "Holz Untersetzer Set",
    "LED Acryl Schild",
    "Leder Schlüsselanhänger",
    "Schiefer Namensschild",
  ].map((n) => n.toLowerCase())
)

function isCancelledOrder(status: string): boolean {
  return status === "storniert"
}

function productCreatedAtMs(product: AdminProduct): number {
  const raw = product.createdAt ?? (product as { updatedAt?: string }).updatedAt
  if (!raw) return 0
  const ms = new Date(raw).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function isLegacyDemoProduct(product: AdminProduct): boolean {
  const name = String(product.name ?? "")
    .trim()
    .toLowerCase()
  if (name && LEGACY_DEMO_PRODUCT_NAMES.has(name)) return true
  // Alte numerische Seed-IDs ohne echte Galerie
  if (/^[1-8]$/.test(String(product.id ?? "").trim()) && !hasUsableProductImage(product)) {
    return true
  }
  return false
}

function isVisibleForServices(
  product: AdminProduct,
  services: ServiceVisibilitySettings
): boolean {
  if (!isProductVisibleInShop(product)) return false
  if (isLegacyDemoProduct(product)) return false
  if (product.type === "3d" && !services.druck3d) return false
  if (product.type === "laser" && !services.lasergravur) return false
  return true
}

/** Echte Galerie-/Listenbilder — keine Platzhalter und keine alten Filament-Demo-Pfade. */
export function hasUsableProductImage(
  product: Pick<AdminProduct, "images" | "galerieBilder">
): boolean {
  const candidates = [
    ...(Array.isArray(product.galerieBilder) ? product.galerieBilder : []),
    ...(Array.isArray(product.images) ? product.images : []),
  ]
  return candidates.some((raw) => {
    if (typeof raw !== "string") return false
    const src = raw.trim()
    if (!src) return false
    if (src.startsWith("/filaments/")) return false
    if (src === NEUTRAL_PRODUCT_PLACEHOLDER) return false
    if (/placeholder\.(svg|png|jpg|jpeg|webp)$/i.test(src)) return false
    if (/\/placeholder(\.|$)/i.test(src)) return false
    return true
  })
}

/**
 * Zählt verkaufte Einheiten aus nicht-stornierten Bestellungen (Katalog-productId → Menge).
 * Bevorzugt `CartItem.productId` (stabile Produkt-ID); fällt auf `id` zurück,
 * sofern diese keine Timestamp-Warenkorbzeile ist (`productId-timestamp`).
 */
export function countSoldUnitsByProductId(orders: StoredOrder[]): Map<string, number> {
  const sales = new Map<string, number>()

  for (const order of orders) {
    if (isCancelledOrder(order.status)) continue
    for (const item of order.items ?? []) {
      const explicit =
        typeof item.productId === "string" ? item.productId.trim() : ""
      const lineId = typeof item.id === "string" ? item.id.trim() : ""
      let productId = explicit
      if (!productId && lineId) {
        // Legacy: Zeilen-ID war früher die Produkt-ID; neu: `${productId}-${Date.now()}`
        const stamped = lineId.match(/^(.*)-(\d{10,})$/)
        productId = stamped?.[1]?.trim() || lineId
      }
      if (!productId) continue
      const qty = Math.max(1, Number(item.quantity) || 1)
      sales.set(productId, (sales.get(productId) ?? 0) + qty)
    }
  }

  return sales
}

function pushUnique(
  result: AdminProduct[],
  picked: Set<string>,
  product: AdminProduct,
  limit: number
): boolean {
  if (result.length >= limit) return false
  if (picked.has(product.id)) return false
  picked.add(product.id)
  result.push(product)
  return result.length < limit
}

/**
 * Top-Produkte / Bestseller für die Startseite.
 *
 * 1. Meistverkaufte Produkte (echte Order-Items, absteigend nach Menge)
 * 2. Auffüllen mit manuell markierten Empfehlungen (`isTopProduct`)
 * 3. Auffüllen mit neuesten Produkten (`createdAt` DESC)
 */
export function resolveTopProducts(options: {
  products: AdminProduct[]
  orders: StoredOrder[]
  services: ServiceVisibilitySettings
  limit: number
}): AdminProduct[] {
  const limit = normalizeTopProductsCount(options.limit)
  const eligible = options.products.filter((p) =>
    isVisibleForServices(p, options.services)
  )
  if (eligible.length === 0 || limit <= 0) return []

  const sales = countSoldUnitsByProductId(options.orders)
  const byId = new Map(eligible.map((p) => [p.id, p]))
  const picked = new Set<string>()
  const result: AdminProduct[] = []

  // --- Priorität 1: Bestseller nach verkauften Einheiten (live aus Orders) ---
  const bestsellers = [...sales.entries()]
    .filter(([id, qty]) => qty > 0 && byId.has(id))
    .sort((a, b) => {
      const qtyDiff = b[1] - a[1]
      if (qtyDiff !== 0) return qtyDiff
      const nameA = byId.get(a[0])?.name ?? ""
      const nameB = byId.get(b[0])?.name ?? ""
      return nameA.localeCompare(nameB, "de-CH")
    })

  for (const [id] of bestsellers) {
    const product = byId.get(id)
    if (!product) continue
    if (!pushUnique(result, picked, product, limit)) break
  }
  if (result.length >= limit) return result

  // --- Priorität 2: manuelle Empfehlungen (isTopProduct) ---
  const featured = eligible
    .filter((p) => p.isTopProduct)
    .sort((a, b) => {
      const timeDiff = productCreatedAtMs(b) - productCreatedAtMs(a)
      if (timeDiff !== 0) return timeDiff
      return a.name.localeCompare(b.name, "de-CH")
    })

  for (const product of featured) {
    if (!pushUnique(result, picked, product, limit)) break
  }
  if (result.length >= limit) return result

  // --- Priorität 3: Auffüllen mit neuesten Produkten (createdAt DESC) ---
  const newestWithImage = eligible
    .filter((p) => !picked.has(p.id) && hasUsableProductImage(p))
    .sort((a, b) => {
      const timeDiff = productCreatedAtMs(b) - productCreatedAtMs(a)
      if (timeDiff !== 0) return timeDiff
      return a.name.localeCompare(b.name, "de-CH")
    })

  for (const product of newestWithImage) {
    if (!pushUnique(result, picked, product, limit)) break
  }
  if (result.length >= limit) return result

  const newestRest = eligible
    .filter((p) => !picked.has(p.id))
    .sort((a, b) => {
      const timeDiff = productCreatedAtMs(b) - productCreatedAtMs(a)
      if (timeDiff !== 0) return timeDiff
      return a.name.localeCompare(b.name, "de-CH")
    })

  for (const product of newestRest) {
    if (!pushUnique(result, picked, product, limit)) break
  }

  return result
}
