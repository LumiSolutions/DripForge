import { NextResponse } from "next/server"
import { completeTotpVerification } from "@/lib/admin/staff-auth"
import { TotpSecretError } from "@/lib/admin/staff-totp-setup"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string; secretBase32?: string }
    const code = body.code?.trim() ?? ""
    const secretBase32 = body.secretBase32?.trim() ?? ""

    if (!code) {
      return NextResponse.json(
        { error: "Verifizierungscode erforderlich." },
        { status: 400 }
      )
    }

    return await completeTotpVerification(request, code, {
      enableOnConfirm: true,
      ...(secretBase32 ? { secretBase32 } : {}),
    })
  } catch (error) {
    if (error instanceof TotpSecretError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.error("Admin-Auth: 2FA-Bestaetigung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "2FA-Bestaetigung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
