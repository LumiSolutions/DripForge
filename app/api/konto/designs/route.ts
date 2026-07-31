import { NextResponse } from "next/server"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { getDesignsForCustomer, saveDesign } from "@/lib/konto/designs-db"
import type { SavedCustomerDesign } from "@/lib/konto/account-types"
import { normalizeCustomerEmail } from "@/lib/admin/customers"

export const dynamic = "force-dynamic"

export async function GET() {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  try {
    const designs = await getDesignsForCustomer(email)
    return NextResponse.json({ designs })
  } catch (error) {
    console.error("Konto: Designs konnten nicht geladen werden.", error)
    return NextResponse.json({ designs: [] })
  }
}

export async function POST(request: Request) {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      label?: string
      designType?: "laser" | "3d" | "other"
      previewUrl?: string | null
      config?: Record<string, unknown>
      id?: string
    }

    const label = body.label?.trim()
    if (!label) {
      return NextResponse.json({ error: "Bezeichnung fehlt." }, { status: 400 })
    }

    const designType =
      body.designType === "laser" || body.designType === "3d" || body.designType === "other"
        ? body.designType
        : "other"

    const now = new Date().toISOString()
    const design: SavedCustomerDesign = {
      id: body.id?.trim() || `design-${Date.now().toString(36)}`,
      customerEmail: normalizeCustomerEmail(email),
      label,
      designType,
      previewUrl: body.previewUrl ?? null,
      config: body.config && typeof body.config === "object" ? body.config : {},
      createdAt: now,
      updatedAt: now,
    }

    const saved = await saveDesign(design)
    return NextResponse.json({ design: saved })
  } catch (error) {
    console.error("Konto: Design speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Design konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
