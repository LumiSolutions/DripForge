import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import {
  getSiteConfigProduction,
  getSiteConfigStaging,
  saveSiteConfigStaging,
} from "@/lib/admin/db"
import { SITE_CONFIG_PREVIEW_PARAM } from "@/lib/admin/site-config"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { mergeSiteImages } from "@/lib/admin/site-images"
import { mergeSiteTexts, sanitizeSiteTextsInput } from "@/lib/admin/site-texts"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await warmCosmosInfrastructure()
    const preview =
      new URL(request.url).searchParams.get(SITE_CONFIG_PREVIEW_PARAM) === "true"
    const bundle = preview
      ? await getSiteConfigStaging()
      : await getSiteConfigProduction()
    return NextResponse.json(
      { texts: bundle.texts, images: bundle.images, preview },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Site-Texts API: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      {
        texts: mergeSiteTexts(null),
        images: mergeSiteImages(null),
        preview: false,
      },
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

    const existing = await getSiteConfigStaging()
    const texts = sanitizeSiteTextsInput({ ...existing.texts, ...body.texts })
    const saved = await saveSiteConfigStaging({ texts })
    return NextResponse.json({
      texts: saved.texts,
      images: saved.images,
      environment: "staging",
    })
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
