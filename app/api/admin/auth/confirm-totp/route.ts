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

    return await completeTotpVerification(request, code, {
      enableOnConfirm: true,
    })
  } catch (error) {
    console.error("Admin-Auth: 2FA-Bestaetigung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "2FA-Bestaetigung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
