import { NextResponse } from "next/server"
import { getCustomerByNumber } from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import {
  adminAdjustAiCredits,
  adminSetAiCredits,
} from "@/lib/konto/ai-credits"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const customer = await getCustomerByNumber(decodeURIComponent(id))
    if (!customer) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 })
    }

    const body = (await request.json()) as {
      aiCredits?: number
      delta?: number
    }

    let result
    if (typeof body.aiCredits === "number" && Number.isFinite(body.aiCredits)) {
      result = await adminSetAiCredits(customer.email, body.aiCredits)
    } else if (typeof body.delta === "number" && Number.isFinite(body.delta)) {
      result = await adminAdjustAiCredits(customer.email, body.delta)
    } else {
      return NextResponse.json(
        { error: "aiCredits (Zahl) oder delta (Zahl) erforderlich." },
        { status: 400 }
      )
    }

    if (!result.success) {
      const message =
        result.error === "no_portal_account"
          ? "Kein Portal-Konto für diese E-Mail — Kunde muss sich zuerst registrieren."
          : "KI-Credits konnten nicht gespeichert werden."
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      aiCredits: result.aiCredits,
      email: customer.email,
    })
  } catch (error) {
    console.error("Admin: KI-Credits-Update fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "KI-Credits konnten nicht aktualisiert werden." },
      { status: 500 }
    )
  }
}
