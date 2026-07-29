import { NextResponse } from "next/server"
import { requestPasswordReset } from "@/lib/auth/password-reset-service"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string }
    const email = body.email?.trim() ?? ""

    if (!email) {
      return NextResponse.json({ error: "E-Mail erforderlich." }, { status: 400 })
    }

    // Base-URL für Reset-Link: resolveSiteOrigin() (ENV), nicht Request-Host
    const result = await requestPasswordReset(email)

    if (!result.ok && result.blocked) {
      return NextResponse.json({ error: result.message }, { status: 403 })
    }

    return NextResponse.json({ success: true, message: result.message })
  } catch (error) {
    console.error("Admin-Auth: Passwort-Reset-Anfrage fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Anfrage konnte nicht verarbeitet werden." },
      { status: 500 }
    )
  }
}
