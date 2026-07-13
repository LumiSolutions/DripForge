import { NextResponse } from "next/server"
import {
  cosmosDeleteChartAccount,
  cosmosGetChartAccountByNumber,
  cosmosUpdateChartAccount,
} from "@/lib/admin/cosmos-chart-accounts"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { AccountKind } from "@/lib/accounting/account-types"

type RouteContext = { params: Promise<{ number: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { number } = await context.params
    const decoded = decodeURIComponent(number)
    const body = (await request.json()) as {
      name?: string
      group?: string | null
      type?: AccountKind
      systemCode?: string
      taxType?: string
      isActive?: boolean
      vatBookable?: boolean
      defaultVatRate?: number
    }

    const account = await cosmosUpdateChartAccount(decoded, body)
    return NextResponse.json({ account })
  } catch (error) {
    console.error("Admin-API: Konto konnte nicht aktualisiert werden.", error)
    const message =
      error instanceof Error ? error.message : "Konto konnte nicht aktualisiert werden."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { number } = await context.params
    const decoded = decodeURIComponent(number)
    const existing = await cosmosGetChartAccountByNumber(decoded)
    if (!existing) {
      return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 })
    }

    await cosmosDeleteChartAccount(decoded)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Admin-API: Konto konnte nicht gelöscht werden.", error)
    const message =
      error instanceof Error ? error.message : "Konto konnte nicht gelöscht werden."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
