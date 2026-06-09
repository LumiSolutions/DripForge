import { NextResponse } from "next/server"
import { completeTotpVerification } from "@/lib/admin/staff-auth"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string }
    const code = body.code?.trim() ?? ""

    if (!code) {
      return NextResponse.json(
        { error: "Verifizierungscode erforderlich." },
        { status: 400 }
      )
    }

    return await completeTotpVerification(request, code)
  } catch (error) {
    console.error("Admin-Auth: TOTP-Verifizierung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Verifizierung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
