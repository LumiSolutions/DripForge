import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import { getSiteTexts, saveSiteTexts } from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { mergeSiteTexts, sanitizeSiteTextsInput } from "@/lib/admin/site-texts"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const texts = await getSiteTexts()
    return NextResponse.json(
      { texts },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Site-Texts API: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { texts: mergeSiteTexts(null) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  }
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as { texts?: Partial<Record<string, string>> }
    if (!body.texts || typeof body.texts !== "object") {
      return NextResponse.json({ error: "Text-Daten fehlen." }, { status: 400 })
    }

    const existing = await getSiteTexts()
    const texts = sanitizeSiteTextsInput({ ...existing, ...body.texts })
    const saved = await saveSiteTexts(texts)
    return NextResponse.json({ texts: saved })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Site-Texts API: Speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Texte konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
