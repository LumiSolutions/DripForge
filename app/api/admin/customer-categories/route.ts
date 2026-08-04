import { NextResponse } from "next/server"
import { getSettings, saveSettings } from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { normalizeCustomerCategories } from "@/lib/dripforge/customer-categories"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  const settings = await getSettings()
  return NextResponse.json(
    { customerCategories: settings.customerCategories ?? [] },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  )
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json().catch(() => null)) as {
      customerCategories?: unknown
    } | null

    const current = await getSettings()
    const settings = await saveSettings({
      checkout: current.checkout,
      customerCategories: normalizeCustomerCategories(body?.customerCategories),
    })

    return NextResponse.json({
      customerCategories: settings.customerCategories ?? [],
    })
  } catch (error) {
    console.warn("Admin-API: Kundenkategorien speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Kundenkategorien konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
