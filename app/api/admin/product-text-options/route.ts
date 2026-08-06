import { NextResponse } from "next/server"
import {
  getProductTextOptions,
  upsertProductTextOption,
} from "@/lib/admin/product-text-options-db"
import {
  isProductTextOptionField,
  normalizeProductTextOption,
} from "@/lib/admin/product-text-options"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const options = await getProductTextOptions()
    return NextResponse.json({ options })
  } catch (error) {
    console.error("Admin-API: Textoptionen konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Textoptionen konnten nicht geladen werden.", options: [] },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as {
      field?: string
      text?: string
    }
    const field = body.field?.trim() ?? ""
    const text = body.text?.trim() ?? ""

    if (!isProductTextOptionField(field)) {
      return NextResponse.json({ error: "Ungültiges Textfeld." }, { status: 400 })
    }
    if (!text) {
      return NextResponse.json({ error: "Text fehlt." }, { status: 400 })
    }

    const result = await upsertProductTextOption(
      normalizeProductTextOption({ field, text })
    )
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 })
  } catch (error) {
    console.error("Admin-API: Textoption konnte nicht gespeichert werden.", error)
    return NextResponse.json(
      { error: "Textoption konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
