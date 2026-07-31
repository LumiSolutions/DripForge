import type { AdminProduct, StoredOrder } from "@/lib/admin/types"
import { isProductVisibleInShop } from "@/lib/admin/product-status"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
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

/**
 * Top-Produkte nach Verkaufsrang (meistverkauft zuerst).
 * Fallback: manuell markierte Top-Produkte, danach neueste Produkte.
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
    if (result.length >= limit) break
    const product = byId.get(id)
    if (!product || picked.has(id)) continue
    picked.add(id)
    result.push(product)
  }

  if (result.length < limit) {
    const manualTop = eligible
      .filter((p) => p.isTopProduct && !picked.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, "de-CH"))

    for (const product of manualTop) {
      if (result.length >= limit) break
      picked.add(product.id)
      result.push(product)
    }
  }

  if (result.length < limit) {
    const newest = eligible
      .filter((p) => !picked.has(p.id))
      .sort((a, b) => {
        const timeDiff = productCreatedAtMs(b) - productCreatedAtMs(a)
        if (timeDiff !== 0) return timeDiff
        return a.name.localeCompare(b.name, "de-CH")
      })

    for (const product of newest) {
      if (result.length >= limit) break
      picked.add(product.id)
      result.push(product)
    }
  }

  return result
}
