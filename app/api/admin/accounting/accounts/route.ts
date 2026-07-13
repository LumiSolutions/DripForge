import { NextResponse } from "next/server"
import {
  cosmosCreateChartAccount,
  cosmosGetChartAccounts,
} from "@/lib/admin/cosmos-chart-accounts"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { AccountKind } from "@/lib/accounting/account-types"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const url = new URL(request.url)
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? ""
    let accounts = await cosmosGetChartAccounts()

    if (q) {
      accounts = accounts.filter(
        (account) =>
          account.number.toLowerCase().includes(q) ||
          account.name.toLowerCase().includes(q)
      )
    }

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error("Admin-API: Kontenplan konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Kontenplan konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as {
      number?: string
      name?: string
      group?: string | null
      type?: AccountKind
      systemCode?: string
      taxType?: string
      vatBookable?: boolean
      defaultVatRate?: number
    }

    const account = await cosmosCreateChartAccount({
      number: body.number ?? "",
      name: body.name ?? "",
      group: body.group ?? null,
      type: body.type ?? "Aktiv",
      systemCode: body.systemCode,
      taxType: body.taxType,
      vatBookable: body.vatBookable,
      defaultVatRate: body.defaultVatRate,
    })

    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    console.error("Admin-API: Konto konnte nicht erstellt werden.", error)
    const message =
      error instanceof Error ? error.message : "Konto konnte nicht erstellt werden."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
