import { NextResponse } from "next/server"
import {
  getDocumentTemplateSettings,
  saveDocumentTemplateSettings,
} from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { sanitizeDocumentTemplateInput } from "@/lib/documents/document-template-types"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const template = await getDocumentTemplateSettings()
    return NextResponse.json({ template })
  } catch (error) {
    console.error("Admin: Dokumenten-Vorlage konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Dokumenten-Vorlage konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const existing = await getDocumentTemplateSettings()
    const template = sanitizeDocumentTemplateInput(body, existing)
    const saved = await saveDocumentTemplateSettings(template)
    return NextResponse.json({ template: saved })
  } catch (error) {
    console.error("Admin: Dokumenten-Vorlage konnte nicht gespeichert werden.", error)
    return NextResponse.json(
      { error: "Dokumenten-Vorlage konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
