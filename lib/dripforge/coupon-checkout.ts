import type { CheckoutRuntimeConfig } from "@/lib/dripforge/checkout-config"
import { calculateCheckoutTotals } from "@/lib/dripforge/checkout-config"
import type { CouponDiscountType } from "@/lib/admin/coupon-types"
import {
  calculatePointsDiscountChf,
  normalizeLoyaltyPoints,
} from "@/lib/konto/loyalty-points-config"

export type CheckoutTotalsWithCoupon = {
  subtotal: number
  shippingCost: number
  discountAmount: number
  couponCode?: string
  pointsRedeemed?: number
  pointsDiscountChf?: number
  vat: number
  total: number
  mwstAktiv: boolean
}

export function computeDiscountAmount(
  taxableBeforeDiscount: number,
  discountType: CouponDiscountType,
  discountValue: number
): number {
  if (taxableBeforeDiscount <= 0 || discountValue <= 0) return 0

  if (discountType === "percent") {
    const pct = Math.min(100, Math.max(0, discountValue))
    return Math.round(taxableBeforeDiscount * (pct / 100) * 100) / 100
  }

  return Math.min(taxableBeforeDiscount, Math.max(0, discountValue))
}

export function calculateCheckoutTotalsWithCoupon(
  subtotal: number,
  shippingCost: number,
  config: Pick<CheckoutRuntimeConfig, "mwstAktiv" | "mwstSatz">,
  coupon?: {
    code: string
    discountType: CouponDiscountType
    discountValue: number
  } | null
): CheckoutTotalsWithCoupon {
  const base = calculateCheckoutTotals(subtotal, shippingCost, config)
  if (!coupon) {
    return {
      subtotal: base.subtotal,
      shippingCost: base.shippingCost,
      discountAmount: 0,
      vat: base.vat,
      total: base.total,
      mwstAktiv: base.mwstAktiv,
    }
  }

  const taxableBefore = subtotal + shippingCost
  const discountAmount = computeDiscountAmount(
    taxableBefore,
    coupon.discountType,
    coupon.discountValue
  )
  const taxableAfter = Math.max(0, taxableBefore - discountAmount)
  const vatRate = config.mwstAktiv ? config.mwstSatz / 100 : 0
  const vat = Math.round(taxableAfter * vatRate * 100) / 100
  const total = Math.round((taxableAfter + vat) * 100) / 100

  return {
    subtotal,
    shippingCost,
    discountAmount,
    couponCode: coupon.code,
    vat,
    total,
    mwstAktiv: config.mwstAktiv,
  }
}

/** Gutschein + optionale Treuepunkte auf den Checkout anwenden. */
export function calculateCheckoutTotalsWithDiscounts(
  subtotal: number,
  shippingCost: number,
  config: Pick<CheckoutRuntimeConfig, "mwstAktiv" | "mwstSatz">,
  options?: {
    coupon?: {
      code: string
      discountType: CouponDiscountType
      discountValue: number
    } | null
    pointsToRedeem?: number
  }
): CheckoutTotalsWithCoupon {
  const withCoupon = calculateCheckoutTotalsWithCoupon(
    subtotal,
    shippingCost,
    config,
    options?.coupon ?? null
  )

  const points = normalizeLoyaltyPoints(options?.pointsToRedeem ?? 0)
  if (points <= 0) {
    return withCoupon
  }

  const pointsDiscountChf = Math.min(
    withCoupon.total,
    calculatePointsDiscountChf(points)
  )
  const finalTotal = Math.max(
    0,
    Math.round((withCoupon.total - pointsDiscountChf) * 100) / 100
  )
  const finalVat =
    withCoupon.total > 0
      ? Math.round(withCoupon.vat * (finalTotal / withCoupon.total) * 100) / 100
      : 0

  return {
    ...withCoupon,
    pointsRedeemed: points,
    pointsDiscountChf,
    vat: finalVat,
    total: finalTotal,
  }
}
