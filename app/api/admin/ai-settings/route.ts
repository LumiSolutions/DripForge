import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import { getAiSettings, saveAiSettings } from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import {
  sanitizeAiSettingsInput,
  type AiSettingsDocument,
} from "@/lib/ai/ai-settings-types"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const settings = await getAiSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin AI-Settings: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "KI-Einstellungen konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as { settings?: Partial<AiSettingsDocument> }
    if (!body.settings || typeof body.settings !== "object") {
      return NextResponse.json({ error: "KI-Einstellungen fehlen." }, { status: 400 })
    }

    const existing = await getAiSettings()
    const settings = sanitizeAiSettingsInput({
      ...existing,
      ...body.settings,
      categories: body.settings.categories ?? existing.categories,
    })
    const saved = await saveAiSettings(settings)
    return NextResponse.json({ settings: saved })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin AI-Settings: Speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "KI-Einstellungen konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
