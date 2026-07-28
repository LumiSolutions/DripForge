import { NextResponse } from "next/server"
import { clearPasswordResetFields } from "@/lib/auth/password-reset-service"
import {
  parsePasswordResetToken,
  verifyStoredResetToken,
} from "@/lib/auth/password-reset-token"
import { getStaffById, saveStaff } from "@/lib/admin/staff-db"
import { decryptTotpSecret } from "@/lib/admin/totp-crypto"
import { verifyTotpCode } from "@/lib/admin/totp"
import { hashPassword } from "@/lib/konto/password"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string
      password?: string
      totpCode?: string
    }

    const token = body.token?.trim() ?? ""
    const password = body.password ?? ""
    const totpCode = body.totpCode?.trim() ?? ""

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token und neues Passwort erforderlich." },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Passwort muss mindestens 8 Zeichen haben." },
        { status: 400 }
      )
    }

    const payload = parsePasswordResetToken(token)
    if (!payload || payload.type !== "admin") {
      return NextResponse.json(
        { error: "Ungültiger oder abgelaufener Link." },
        { status: 400 }
      )
    }

    const account = await getStaffById("admin")
    if (!account) {
      return NextResponse.json(
        { error: "Ungültiger oder abgelaufener Link." },
        { status: 400 }
      )
    }

    const verified = verifyStoredResetToken(
      token,
      account.passwordResetTokenHash,
      account.passwordResetExpiresAt
    )
    if (!verified) {
      return NextResponse.json(
        { error: "Ungültiger oder abgelaufener Link." },
        { status: 400 }
      )
    }

    if (account.totpEnabled) {
      if (!totpCode) {
        return NextResponse.json(
          { error: "2FA-Code erforderlich. E-Mail allein reicht nicht aus." },
          { status: 400 }
        )
      }

      if (!account.totpSecretEncrypted) {
        return NextResponse.json(
          { error: "2FA-Konfiguration unvollstaendig." },
          { status: 500 }
        )
      }

      const secret = decryptTotpSecret(account.totpSecretEncrypted)
      if (!secret || !verifyTotpCode(secret, totpCode)) {
        return NextResponse.json(
          { error: "Ungültiger 2FA-Code." },
          { status: 401 }
        )
      }
    }

    await saveStaff(
      clearPasswordResetFields({
        ...account,
        passwordHash: hashPassword(password),
      })
    )

    return NextResponse.json({
      success: true,
      message: "Admin-Passwort wurde erfolgreich geändert.",
    })
  } catch (error) {
    console.error("Admin-Auth: Passwort-Reset fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Passwort konnte nicht geändert werden." },
      { status: 500 }
    )
  }
}
