import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import {
  getDocumentTemplateSettings,
  getSiteConfigMeta,
  getSiteConfigStaging,
  saveDocumentTemplateSettings,
  saveSiteConfigStaging,
} from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { sanitizeSiteTextsInput } from "@/lib/admin/site-texts"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { sanitizeDocumentTemplateInput } from "@/lib/documents/document-template-types"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const [texts, meta, documentTemplate] = await Promise.all([
      getSiteConfigStaging(),
      getSiteConfigMeta(),
      getDocumentTemplateSettings(),
    ])
    return NextResponse.json({ texts, meta, documentTemplate, environment: "staging" })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Site-Config: Laden fehlgeschlagen.", error)
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
    const body = (await request.json()) as {
      texts?: Partial<Record<string, string>>
      documentTemplate?: unknown
    }
    const hasTexts = body.texts && typeof body.texts === "object"
    const hasDocumentTemplate =
      body.documentTemplate && typeof body.documentTemplate === "object"

    if (!hasTexts && !hasDocumentTemplate) {
      return NextResponse.json({ error: "Text- oder Dokumenten-Daten fehlen." }, { status: 400 })
    }

    const [existingTexts, existingDocumentTemplate] = await Promise.all([
      getSiteConfigStaging(),
      getDocumentTemplateSettings(),
    ])

    const savedTexts = hasTexts
      ? await saveSiteConfigStaging(
          sanitizeSiteTextsInput({ ...existingTexts, ...body.texts })
        )
      : existingTexts
    const savedDocumentTemplate = hasDocumentTemplate
      ? await saveDocumentTemplateSettings(
          sanitizeDocumentTemplateInput(body.documentTemplate, existingDocumentTemplate)
        )
      : existingDocumentTemplate
    const meta = await getSiteConfigMeta()
    return NextResponse.json({
      texts: savedTexts,
      meta,
      documentTemplate: savedDocumentTemplate,
      environment: "staging",
    })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Site-Config: Speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Texte konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
