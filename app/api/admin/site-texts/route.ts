import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import {
  getSiteConfigMeta,
  getSiteConfigStaging,
  saveSiteConfigStaging,
} from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { sanitizeSiteTextsInput } from "@/lib/admin/site-texts"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const [bundle, meta] = await Promise.all([
      getSiteConfigStaging(),
      getSiteConfigMeta(),
    ])
    return NextResponse.json({
      texts: bundle.texts,
      images: bundle.images,
      meta,
      environment: "staging",
    })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Site-Texts: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Texte konnten nicht geladen werden." },
      { status: 500 }
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

    const existing = await getSiteConfigStaging()
    const texts = sanitizeSiteTextsInput({ ...existing.texts, ...body.texts })
    const saved = await saveSiteConfigStaging({ texts })
    const meta = await getSiteConfigMeta()
    return NextResponse.json({
      texts: saved.texts,
      images: saved.images,
      meta,
      environment: "staging",
    })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Site-Texts: Speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Texte konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
