import { NextResponse } from "next/server"
import { getAccountByEmail, isActiveCustomerAccount, saveAccount } from "@/lib/konto/account-db"
import {
  isCustomerAuthError,
  requireCustomerSession,
} from "@/lib/konto/customer-api-auth"
import { hashPassword, verifyPassword } from "@/lib/konto/password"

export async function POST(request: Request) {
  const auth = await requireCustomerSession()
  if (isCustomerAuthError(auth)) return auth

  try {
    const body = (await request.json()) as {
      currentPassword?: string
      newPassword?: string
    }

    const currentPassword = body.currentPassword ?? ""
    const newPassword = body.newPassword ?? ""

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Aktuelles und neues Passwort erforderlich." },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Neues Passwort muss mindestens 8 Zeichen haben." },
        { status: 400 }
      )
    }

    const account = await getAccountByEmail(auth.email)
    if (!account || !isActiveCustomerAccount(account)) {
      return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 })
    }

    if (!verifyPassword(currentPassword, account.passwordHash)) {
      return NextResponse.json(
        { error: "Aktuelles Passwort ist falsch." },
        { status: 403 }
      )
    }

    await saveAccount({
      ...account,
      passwordHash: hashPassword(newPassword),
    })

    return NextResponse.json({ success: true, message: "Passwort wurde geaendert." })
  } catch (error) {
    console.error("Konto: Passwort-Aenderung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Passwort konnte nicht geaendert werden." },
      { status: 500 }
    )
  }
}
