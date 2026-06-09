import { NextResponse } from "next/server"
import { createCouponInput, getCoupons, upsertCoupon } from "@/lib/admin/coupon-db"
import { normalizeCouponCode } from "@/lib/admin/coupon-types"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { CouponDiscountType } from "@/lib/admin/coupon-types"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const coupons = await getCoupons()
    return NextResponse.json({ coupons })
  } catch (error) {
    console.error("Admin-API: Gutscheine konnten nicht geladen werden.", error)
    return NextResponse.json(
      { coupons: [] },
      { headers: { "X-DripForge-Degraded": "1" } }
    )
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as {
      code?: string
      discountType?: CouponDiscountType
      discountValue?: number
      expiresAt?: string | null
      maxRedemptions?: number | null
      aktiv?: boolean
    }

    const code = normalizeCouponCode(body.code ?? "")
    if (!code) {
      return NextResponse.json({ error: "Code-Name fehlt." }, { status: 400 })
    }

    if (body.discountType !== "percent" && body.discountType !== "fixed") {
      return NextResponse.json(
        { error: "Rabatt-Typ muss percent oder fixed sein." },
        { status: 400 }
      )
    }

    const coupon = createCouponInput({
      code,
      discountType: body.discountType,
      discountValue: Number(body.discountValue) || 0,
      expiresAt: body.expiresAt ?? null,
      maxRedemptions: body.maxRedemptions ?? null,
      aktiv: body.aktiv,
    })

    if (body.discountType === "percent" && coupon.discountValue > 100) {
      return NextResponse.json(
        { error: "Prozent-Rabatt darf maximal 100% sein." },
        { status: 400 }
      )
    }

    const saved = await upsertCoupon(coupon)
    return NextResponse.json({ coupon: saved }, { status: 201 })
  } catch (error) {
    console.error("Admin-API: Gutschein konnte nicht erstellt werden.", error)
    return NextResponse.json(
      { error: "Gutschein konnte nicht erstellt werden." },
      { status: 500 }
    )
  }
}
