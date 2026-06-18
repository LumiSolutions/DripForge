import { NextResponse } from "next/server"
import { setupTotpForPending } from "@/lib/admin/staff-auth"
import { TotpSecretError } from "@/lib/admin/staff-totp-setup"

export async function POST(request: Request) {
  try {
    return await setupTotpForPending(request)
  } catch (error) {
    if (error instanceof TotpSecretError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.error("Admin-Auth: 2FA-Setup fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "2FA-Einrichtung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
