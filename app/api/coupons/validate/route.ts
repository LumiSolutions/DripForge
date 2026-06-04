import { NextResponse } from "next/server"
import { getCouponByCode } from "@/lib/admin/coupon-db"
import { validateCouponForCheckout } from "@/lib/admin/coupon-validation"
import { normalizeCouponCode } from "@/lib/admin/coupon-types"
import {
  calculateCheckoutTotalsWithCoupon,
  type CheckoutTotalsWithCoupon,
} from "@/lib/dripforge/coupon-checkout"
import {
  getShippingCost,
  type ShippingMethodId,
} from "@/lib/dripforge/checkout-config"
import { getSettings } from "@/lib/admin/db"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string
      subtotal?: number
      shippingMethod?: ShippingMethodId
    }

    const code = normalizeCouponCode(body.code ?? "")
    if (!code) {
      return NextResponse.json(
        { valid: false, error: "Bitte einen Gutscheincode eingeben." },
        { status: 400 }
      )
    }

    const subtotal = Math.max(0, Number(body.subtotal) || 0)
    const shippingMethod = body.shippingMethod ?? "bpost"
    const shippingCost = getShippingCost(shippingMethod)

    const settings = await getSettings()
    const coupon = await getCouponByCode(code)
    const validation = validateCouponForCheckout(coupon, code)

    if (!validation.valid) {
      return NextResponse.json({ valid: false, error: validation.error })
    }

    const totals: CheckoutTotalsWithCoupon = calculateCheckoutTotalsWithCoupon(
      subtotal,
      shippingCost,
      settings.checkout,
      {
        code: validation.coupon.code,
        discountType: validation.coupon.discountType,
        discountValue: validation.coupon.discountValue,
      }
    )

    return NextResponse.json({
      valid: true,
      code: validation.coupon.code,
      discountType: validation.coupon.discountType,
      discountValue: validation.coupon.discountValue,
      discountLabel:
        validation.coupon.discountType === "percent"
          ? `${validation.coupon.discountValue}%`
          : `CHF ${validation.coupon.discountValue.toFixed(2)}`,
      totals,
    })
  } catch (error) {
    console.error("Gutschein-API: Validierung fehlgeschlagen.", error)
    return NextResponse.json(
      { valid: false, error: "Gutschein konnte nicht geprueft werden." },
      { status: 500 }
    )
  }
}
