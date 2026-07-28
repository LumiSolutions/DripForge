import { NextResponse } from "next/server"
import { generateTemporaryPassword } from "@/lib/auth/password-reset-token"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { getStaffById, saveStaff } from "@/lib/admin/staff-db"
import { hashPassword } from "@/lib/konto/password"

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as {
      password?: string
      generateTemporary?: boolean
    }

    const account = await getStaffById("tester")
    if (!account) {
      return NextResponse.json(
        { error: "Tester-Konto nicht gefunden." },
        { status: 404 }
      )
    }

    let newPassword: string
    let temporary = false

    if (body.generateTemporary) {
      newPassword = generateTemporaryPassword()
      temporary = true
    } else {
      newPassword = body.password?.trim() ?? ""
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "Passwort muss mindestens 8 Zeichen haben." },
          { status: 400 }
        )
      }
    }

    await saveStaff({
      ...account,
      passwordHash: hashPassword(newPassword),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    })

    return NextResponse.json({
      success: true,
      message: temporary
        ? "Temporaeres Tester-Passwort erstellt."
        : "Tester-Passwort wurde aktualisiert.",
      temporaryPassword: temporary ? newPassword : undefined,
    })
  } catch (error) {
    console.error("Admin: Tester-Passwort-Reset fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Passwort konnte nicht zurückgesetzt werden." },
      { status: 500 }
    )
  }
}
