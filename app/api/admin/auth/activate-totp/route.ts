import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { getStaffById, saveStaff } from "@/lib/admin/staff-db"
import { encryptTotpSecret } from "@/lib/admin/totp-crypto"
import { verifyTotpCode } from "@/lib/admin/totp"

/** 2FA nach Profil-Reset mit Code aus der App aktivieren. */
export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as { code?: string; secretBase32?: string }
    const code = body.code?.trim() ?? ""
    const secretBase32 = body.secretBase32?.replace(/\s/g, "") ?? ""

    if (!code) {
      return NextResponse.json(
        { error: "Verifizierungscode erforderlich." },
        { status: 400 }
      )
    }

    if (!secretBase32) {
      return NextResponse.json(
        { error: "2FA-Secret fehlt. Bitte Setup erneut starten." },
        { status: 400 }
      )
    }

    const account = await getStaffById(auth.userId)
    if (!account) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden." },
        { status: 404 }
      )
    }

    if (!verifyTotpCode(secretBase32, code)) {
      return NextResponse.json(
        { error: "Ungueltiger Verifizierungscode." },
        { status: 401 }
      )
    }

    await saveStaff({
      ...account,
      totpSecretEncrypted: encryptTotpSecret(secretBase32),
      totpEnabled: true,
    })

    return NextResponse.json({
      success: true,
      message: "Zwei-Faktor-Authentisierung ist aktiv.",
    })
  } catch (error) {
    console.error("Admin-Auth: 2FA-Aktivierung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "2FA-Aktivierung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
