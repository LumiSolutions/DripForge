import type { AdminProduct, StoredOrder } from "@/lib/admin/types"
import { isProductVisibleInShop } from "@/lib/admin/product-status"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import { NEUTRAL_PRODUCT_PLACEHOLDER } from "@/lib/dripforge/neutral-placeholder"
import { normalizeTopProductsCount } from "@/lib/dripforge/top-products-settings"

function isCancelledOrder(status: string): boolean {
  return status === "storniert"
}

function productCreatedAtMs(product: AdminProduct): number {
  const raw = product.createdAt
  if (!raw) return 0
  const ms = new Date(raw).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function isVisibleForServices(
  product: AdminProduct,
  services: ServiceVisibilitySettings
): boolean {
  if (!isProductVisibleInShop(product)) return false
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
 * Zählt verkaufte Einheiten aus nicht-stornierten Bestellungen (productId → Menge).
 * CartItem.id entspricht der Produkt-ID im Katalog.
 */
export function countSoldUnitsByProductId(orders: StoredOrder[]): Map<string, number> {
  const sales = new Map<string, number>()

  for (const order of orders) {
    if (isCancelledOrder(order.status)) continue
    for (const item of order.items ?? []) {
      const productId = typeof item.id === "string" ? item.id.trim() : ""
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
 * Top-Produkte für die Startseite.
 * 1. Manuell markierte Top-Produkte (`isTopProduct` / Featured)
 * 2. Bestseller nach verkauften Einheiten (nur mit nutzbarem Bild)
 * 3. Neueste aktive Produkte (nur mit nutzbarem Bild)
 *
 * Produkte ohne echte Bilder werden nicht als Filler genutzt — so bleiben
 * Seed-/Demo-Einträge ohne Galerie von der Homepage fern.
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

  // 1) Featured zuerst (auch ohne Bild — Admin hat sie bewusst markiert)
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

  // 2) Bestseller mit echtem Bild
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
    if (!product || !hasUsableProductImage(product)) continue
    if (!pushUnique(result, picked, product, limit)) break
  }
  if (result.length >= limit) return result

  // 3) Neueste mit echtem Bild (kein Seed-/Platzhalter-Filler)
  const newest = eligible
    .filter((p) => !picked.has(p.id) && hasUsableProductImage(p))
    .sort((a, b) => {
      const timeDiff = productCreatedAtMs(b) - productCreatedAtMs(a)
      if (timeDiff !== 0) return timeDiff
      return a.name.localeCompare(b.name, "de-CH")
    })

  for (const product of newest) {
    if (!pushUnique(result, picked, product, limit)) break
  }

  return result
}
