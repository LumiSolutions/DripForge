import { NextResponse } from "next/server"
import { clearPasswordResetFields } from "@/lib/auth/password-reset-service"
import {
  parsePasswordResetToken,
  verifyStoredResetToken,
} from "@/lib/auth/password-reset-token"
import { getAccountByEmail, saveAccount } from "@/lib/konto/account-db"
import { hashPassword } from "@/lib/konto/password"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string
      password?: string
    }

    const token = body.token?.trim() ?? ""
    const password = body.password ?? ""

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
    if (!payload || payload.type !== "customer") {
      return NextResponse.json(
        { error: "Ungueltiger oder abgelaufener Link." },
        { status: 400 }
      )
    }

    const account = await getAccountByEmail(payload.accountId)
    if (!account) {
      return NextResponse.json(
        { error: "Ungueltiger oder abgelaufener Link." },
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
        { error: "Ungueltiger oder abgelaufener Link." },
        { status: 400 }
      )
    }

    await saveAccount(
      clearPasswordResetFields({
        ...account,
        passwordHash: hashPassword(password),
      })
    )

    return NextResponse.json({
      success: true,
      message: "Passwort wurde erfolgreich geaendert. Sie koennen sich jetzt anmelden.",
    })
  } catch (error) {
    console.error("Konto: Passwort-Reset fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Passwort konnte nicht geaendert werden." },
      { status: 500 }
    )
  }
}
