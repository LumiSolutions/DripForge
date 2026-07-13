import { NextResponse } from "next/server"
import {
  cosmosCreateTaxCode,
  cosmosEnsureDefaultTaxCodes,
  cosmosGetTaxCodes,
} from "@/lib/admin/cosmos-tax-codes"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { TaxCodeCategory } from "@/lib/accounting/tax-code-types"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const url = new URL(request.url)
    const includeInactive = url.searchParams.get("includeInactive") === "1"
    const ensure = url.searchParams.get("ensure") === "1"

    const taxCodes = ensure
      ? await cosmosEnsureDefaultTaxCodes()
      : await cosmosGetTaxCodes({ includeInactive })

    return NextResponse.json({ taxCodes })
  } catch (error) {
    console.error("Admin-API: Steuercodes konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Steuercodes konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as {
      code?: string
      systemCode?: string
      name?: string
      rate?: number
      category?: TaxCodeCategory
      isActive?: boolean
      sortOrder?: number
    }

    const taxCode = await cosmosCreateTaxCode({
      code: body.code ?? "",
      systemCode: body.systemCode,
      name: body.name ?? "",
      rate: Number(body.rate) || 0,
      category: body.category ?? "Befreit",
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    })

    return NextResponse.json({ taxCode }, { status: 201 })
  } catch (error) {
    console.error("Admin-API: Steuercode konnte nicht erstellt werden.", error)
    const message =
      error instanceof Error ? error.message : "Steuercode konnte nicht erstellt werden."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
