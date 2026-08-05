import { NextResponse } from "next/server"
import { deleteCoupon, getCouponByCode, upsertCoupon, archiveCoupon, restoreCoupon } from "@/lib/admin/coupon-db"
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
      archiviert: boolean
    }>

    const current = await getCouponByCode(id)
    if (!current) {
      return NextResponse.json(
        { error: "Gutschein nicht gefunden." },
        { status: 404 }
      )
    }

    // Soft-Delete / Wiederherstellen über PATCH
    if (body.archiviert === true && !current.archiviert) {
      const archived = await archiveCoupon(id)
      return NextResponse.json({ coupon: archived })
    }
    if (body.archiviert === false && current.archiviert) {
      const restored = await restoreCoupon(id)
      return NextResponse.json({ coupon: restored })
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
      archiviert: current.archiviert === true,
      archivedAt: current.archivedAt ?? null,
    }

    const saved = await upsertCoupon(next)
    return NextResponse.json({ coupon: saved })
  } catch (error) {
    console.error("Admin-API: Gutschein-Update fehlgeschlagen.", error)
    return NextResponse.json({ error: "Update fehlgeschlagen." }, { status: 500 })
  }
}

/**
 * Hartes Löschen nur für bereits archivierte Gutscheine (manuell).
 * Standard-Aktion im UI ist Soft-Delete (archivieren).
 */
export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const current = await getCouponByCode(id)
    if (!current) {
      return NextResponse.json(
        { error: "Gutschein nicht gefunden." },
        { status: 404 }
      )
    }
    if (current.archiviert !== true) {
      const archived = await archiveCoupon(id)
      return NextResponse.json({
        success: true,
        softDeleted: true,
        coupon: archived,
      })
    }
    const ok = await deleteCoupon(normalizeCouponCode(id))
    if (!ok) {
      return NextResponse.json(
        { error: "Gutschein nicht gefunden." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, softDeleted: false })
  } catch (error) {
    console.error("Admin-API: Gutschein-Löschen fehlgeschlagen.", error)
    return NextResponse.json({ error: "Löschen fehlgeschlagen." }, { status: 500 })
  }
}
