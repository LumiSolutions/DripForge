import { NextResponse } from "next/server"
import { deleteCoupon, getCouponByCode, upsertCoupon } from "@/lib/admin/coupon-db"
import { normalizeCouponCode } from "@/lib/admin/coupon-types"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { CouponDiscountType, StoredCoupon } from "@/lib/admin/coupon-types"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const body = (await request.json()) as Partial<{
      discountType: CouponDiscountType
      discountValue: number
      expiresAt: string | null
      maxRedemptions: number | null
      aktiv: boolean
    }>

    const current = await getCouponByCode(id)
    if (!current) {
      return NextResponse.json(
        { error: "Gutschein nicht gefunden." },
        { status: 404 }
      )
    }

    const next: StoredCoupon = {
      ...current,
      discountType:
        body.discountType === "fixed" || body.discountType === "percent"
          ? body.discountType
          : current.discountType,
      discountValue:
        typeof body.discountValue === "number"
          ? body.discountValue
          : current.discountValue,
      expiresAt:
        body.expiresAt === null
          ? null
          : body.expiresAt?.trim()
            ? body.expiresAt.trim()
            : current.expiresAt,
      maxRedemptions:
        body.maxRedemptions === null
          ? null
          : typeof body.maxRedemptions === "number"
            ? body.maxRedemptions
            : current.maxRedemptions,
      aktiv: typeof body.aktiv === "boolean" ? body.aktiv : current.aktiv,
    }

    const saved = await upsertCoupon(next)
    return NextResponse.json({ coupon: saved })
  } catch (error) {
    console.error("Admin-API: Gutschein-Update fehlgeschlagen.", error)
    return NextResponse.json({ error: "Update fehlgeschlagen." }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const ok = await deleteCoupon(normalizeCouponCode(id))
    if (!ok) {
      return NextResponse.json(
        { error: "Gutschein nicht gefunden." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin-API: Gutschein-Löschen fehlgeschlagen.", error)
    return NextResponse.json({ error: "Löschen fehlgeschlagen." }, { status: 500 })
  }
}
