import { NextResponse } from "next/server"
import {
  cosmosDeleteTaxCode,
  cosmosUpdateTaxCode,
} from "@/lib/admin/cosmos-tax-codes"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { TaxCodeCategory } from "@/lib/accounting/tax-code-types"

type RouteContext = { params: Promise<{ code: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { code } = await context.params
    const body = (await request.json()) as {
      systemCode?: string
      name?: string
      rate?: number
      category?: TaxCodeCategory
      isActive?: boolean
      sortOrder?: number
    }

    const taxCode = await cosmosUpdateTaxCode(decodeURIComponent(code), {
      systemCode: body.systemCode,
      name: body.name,
      rate: body.rate != null ? Number(body.rate) : undefined,
      category: body.category,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    })

    return NextResponse.json({ taxCode })
  } catch (error) {
    console.error("Admin-API: Steuercode konnte nicht aktualisiert werden.", error)
    const message =
      error instanceof Error
        ? error.message
        : "Steuercode konnte nicht aktualisiert werden."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { code } = await context.params
    await cosmosDeleteTaxCode(decodeURIComponent(code))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Admin-API: Steuercode konnte nicht gelöscht werden.", error)
    const message =
      error instanceof Error
        ? error.message
        : "Steuercode konnte nicht gelöscht werden."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
