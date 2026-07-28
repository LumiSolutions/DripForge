import type { StoredCoupon } from "@/lib/admin/coupon-types"
import { normalizeCouponCode } from "@/lib/admin/coupon-types"

export type CouponValidationResult =
  | { valid: true; coupon: StoredCoupon }
  | { valid: false; error: string }

export function validateCouponForCheckout(
  coupon: StoredCoupon | null,
  rawCode: string
): CouponValidationResult {
  const code = normalizeCouponCode(rawCode)

  if (!coupon) {
    return { valid: false, error: "Gutscheincode ist ungültig." }
  }

  if (!coupon.aktiv) {
    return { valid: false, error: "Dieser Gutschein ist nicht mehr aktiv." }
  }

  if (coupon.code !== code) {
    return { valid: false, error: "Gutscheincode ist ungültig." }
  }

  if (coupon.expiresAt) {
    const end = new Date(coupon.expiresAt)
    end.setHours(23, 59, 59, 999)
    if (Date.now() > end.getTime()) {
      return { valid: false, error: "Dieser Gutschein ist abgelaufen." }
    }
  }

  if (
    coupon.maxRedemptions != null &&
    coupon.redemptionCount >= coupon.maxRedemptions
  ) {
    return {
      valid: false,
      error: "Dieser Gutschein wurde bereits maximal oft eingeloest.",
    }
  }

  if (coupon.discountValue <= 0) {
    return { valid: false, error: "Gutschein ist fehlerhaft konfiguriert." }
  }

  if (coupon.discountType === "percent" && coupon.discountValue > 100) {
    return { valid: false, error: "Prozent-Rabatt darf maximal 100% sein." }
  }

  return { valid: true, coupon }
}
