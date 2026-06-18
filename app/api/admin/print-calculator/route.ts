import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import { getPrintCalculatorSettings, savePrintCalculatorSettings } from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import {
  sanitizePrintCalculatorSettings,
  type PrintCalculatorSettings,
} from "@/lib/admin/print-calculator-types"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const settings = await getPrintCalculatorSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error(
      "Admin Druck-Kalkulator: Laden fehlgeschlagen.",
      formatCosmosError(error)
    )
    return NextResponse.json(
      { error: "Druck-Kalkulator-Einstellungen konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as { settings?: Partial<PrintCalculatorSettings> }
    if (!body.settings || typeof body.settings !== "object") {
      return NextResponse.json({ error: "Einstellungen fehlen." }, { status: 400 })
    }

    const existing = await getPrintCalculatorSettings()
    const settings = sanitizePrintCalculatorSettings({
      ...existing,
      ...body.settings,
      global: { ...existing.global, ...body.settings.global },
      printers: body.settings.printers ?? existing.printers,
      materials: body.settings.materials ?? existing.materials,
    })
    const saved = await savePrintCalculatorSettings(settings)
    return NextResponse.json({ settings: saved })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Druck-Kalkulator: Speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Druck-Kalkulator-Einstellungen konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
