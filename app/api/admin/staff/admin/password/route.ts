import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { getStaffById, saveStaff, verifyStaffPassword } from "@/lib/admin/staff-db"
import { hashPassword } from "@/lib/konto/password"

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as {
      password?: string
      currentPassword?: string
    }

    const newPassword = body.password?.trim() ?? ""
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Passwort muss mindestens 8 Zeichen haben." },
        { status: 400 }
      )
    }

    const currentPassword = body.currentPassword?.trim() ?? ""
    if (currentPassword) {
      const verified = await verifyStaffPassword("admin", currentPassword)
      if (!verified) {
        return NextResponse.json(
          { error: "Aktuelles Passwort ist falsch." },
          { status: 403 }
        )
      }
    }

    const account = await getStaffById("admin")
    if (!account) {
      return NextResponse.json(
        { error: "Admin-Konto nicht gefunden." },
        { status: 404 }
      )
    }

    await saveStaff({
      ...account,
      passwordHash: hashPassword(newPassword),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    })

    return NextResponse.json({
      success: true,
      message: "Admin-Passwort wurde aktualisiert.",
    })
  } catch (error) {
    console.error("Admin: Passwort-Änderung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Passwort konnte nicht geändert werden." },
      { status: 500 }
    )
  }
}
