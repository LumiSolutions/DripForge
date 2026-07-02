import { NextResponse } from "next/server"
import {
  getInvoiceTemplateSettings,
  saveInvoiceTemplateSettings,
} from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { sanitizeInvoiceTemplateInput } from "@/lib/invoices/invoice-template-types"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const template = await getInvoiceTemplateSettings()
    return NextResponse.json({ template })
  } catch (error) {
    console.error("Admin: Rechnungsvorlage konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Rechnungsvorlage konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const existing = await getInvoiceTemplateSettings()
    const template = sanitizeInvoiceTemplateInput(body, existing)
    const saved = await saveInvoiceTemplateSettings(template)
    return NextResponse.json({ template: saved })
  } catch (error) {
    console.error("Admin: Rechnungsvorlage konnte nicht gespeichert werden.", error)
    return NextResponse.json(
      { error: "Rechnungsvorlage konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
