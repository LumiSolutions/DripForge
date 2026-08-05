export type CouponDiscountType = "percent" | "fixed"

export type StoredCoupon = {
  /** Normalisierter Code (Grossbuchstaben), Cosmos-Partition */
  id: string
  code: string
  discountType: CouponDiscountType
  discountValue: number
  /** ISO-Datum (Ende des Tages gültig) oder null = kein Ablauf */
  expiresAt: string | null
  /** null = unbegrenzt */
  maxRedemptions: number | null
  redemptionCount: number
  aktiv: boolean
  /** Soft-Delete: archivierte Codes bleiben erhalten, sind aber nicht einlösbar. */
  archiviert?: boolean
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type CouponListFilter = "all" | "active" | "inactive" | "archived"

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "")
}

export function isCouponArchived(coupon: Pick<StoredCoupon, "archiviert">): boolean {
  return coupon.archiviert === true
}

export function matchesCouponFilter(
  coupon: StoredCoupon,
  filter: CouponListFilter
): boolean {
  const archived = isCouponArchived(coupon)
  switch (filter) {
    case "archived":
      return archived
    case "active":
      return !archived && coupon.aktiv
    case "inactive":
      return !archived && !coupon.aktiv
    case "all":
    default:
      return true
  }
}
