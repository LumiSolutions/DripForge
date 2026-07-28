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
  createdAt: string
  updatedAt: string
}

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "")
}
