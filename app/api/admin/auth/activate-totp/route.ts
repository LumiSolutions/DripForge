import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { getStaffById, saveStaff } from "@/lib/admin/staff-db"
import { decryptTotpSecret } from "@/lib/admin/totp-crypto"
import { verifyTotpCode } from "@/lib/admin/totp"

/** 2FA nach Profil-Reset mit Code aus der App aktivieren. */
export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as { code?: string }
    const code = body.code?.trim() ?? ""

    if (!code) {
      return NextResponse.json(
        { error: "Verifizierungscode erforderlich." },
        { status: 400 }
      )
    }

    const account = await getStaffById(auth.userId)
    if (!account?.totpSecretEncrypted) {
      return NextResponse.json(
        { error: "2FA-Setup wurde noch nicht gestartet." },
        { status: 400 }
      )
    }

    const secret = decryptTotpSecret(account.totpSecretEncrypted)
    if (!secret || !verifyTotpCode(secret, code)) {
      return NextResponse.json(
        { error: "Ungueltiger Verifizierungscode." },
        { status: 401 }
      )
    }

    await saveStaff({
      ...account,
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
