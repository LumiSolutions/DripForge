export type QuantityDiscountTier = {
  /** Ab dieser Stückzahl (inkl.) */
  minQty: number
  /** Rabatt in Prozent auf den Stückpreis (0–100) */
  discountPercent: number
}

export function normalizeQuantityDiscountTiers(
  input?: unknown
): QuantityDiscountTier[] {
  if (!Array.isArray(input)) return []
  const tiers: QuantityDiscountTier[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue
    const row = raw as Partial<QuantityDiscountTier>
    const minQty = Math.round(Number(row.minQty))
    const discountPercent = Number(row.discountPercent)
    if (!Number.isFinite(minQty) || minQty < 2) continue
    if (!Number.isFinite(discountPercent) || discountPercent <= 0) continue
    tiers.push({
      minQty,
      discountPercent: Math.min(90, Math.max(0.1, discountPercent)),
    })
  }
  return tiers.sort((a, b) => a.minQty - b.minQty)
}

/** Höchste passende Staffel für eine Gesamtmenge. */
export function resolveQuantityDiscountTier(
  tiers: QuantityDiscountTier[] | null | undefined,
  quantity: number
): QuantityDiscountTier | null {
  const list = normalizeQuantityDiscountTiers(tiers)
  if (!list.length) return null
  const qty = Math.max(0, Math.round(Number(quantity) || 0))
  let matched: QuantityDiscountTier | null = null
  for (const tier of list) {
    if (qty >= tier.minQty) matched = tier
  }
  return matched
}

export function applyQuantityDiscountToUnitPrice(
  unitPrice: number,
  tiers: QuantityDiscountTier[] | null | undefined,
  quantity: number
): { unitPrice: number; discountPercent: number; tier: QuantityDiscountTier | null } {
  const base = Math.max(0, Number(unitPrice) || 0)
  const tier = resolveQuantityDiscountTier(tiers, quantity)
  if (!tier) {
    return { unitPrice: base, discountPercent: 0, tier: null }
  }
  const discounted =
    Math.round(base * (1 - tier.discountPercent / 100) * 100) / 100
  return {
    unitPrice: Math.max(0, discounted),
    discountPercent: tier.discountPercent,
    tier,
  }
}

/**
 * Gruppiert Warenkorb-Zeilen nach productId und liefert die Gesamtmenge
 * pro Produkt (für variantenübergreifenden Mengenrabatt).
 */
export function cartQuantityByProductId(
  items: Array<{ productId?: string | null; quantity?: number }>
): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of items) {
    const id = item.productId?.trim()
    if (!id) continue
    const qty = Math.max(1, Number(item.quantity) || 1)
    map.set(id, (map.get(id) ?? 0) + qty)
  }
  return map
}

type CartDiscountable = {
  productId?: string | null
  price: number
  quantity: number
  baseUnitPrice?: number
  quantityDiscountTiers?: QuantityDiscountTier[] | null
}

/**
 * Wendet Staffelpreise variantenübergreifend an: Summe der Mengen
 * derselben productId bestimmt die Staffel; jede Zeile behält
 * ihren eigenen baseUnitPrice.
 */
export function applyQuantityDiscountsToCartItems<T extends CartDiscountable>(
  items: T[]
): T[] {
  if (!items.length) return items
  const qtyByProduct = cartQuantityByProductId(items)
  let changed = false
  const next = items.map((item) => {
    const productId = item.productId?.trim()
    const tiers = item.quantityDiscountTiers
    if (!productId || !tiers?.length) return item
    const base =
      item.baseUnitPrice != null && Number.isFinite(item.baseUnitPrice)
        ? Number(item.baseUnitPrice)
        : Number(item.price) || 0
    const totalQty = qtyByProduct.get(productId) ?? item.quantity
    const { unitPrice } = applyQuantityDiscountToUnitPrice(base, tiers, totalQty)
    if (unitPrice === item.price && item.baseUnitPrice === base) return item
    changed = true
    return { ...item, baseUnitPrice: base, price: unitPrice }
  })
  return changed ? next : items
}
