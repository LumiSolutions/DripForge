import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { clearAllStaff2fa, clearStaff2fa } from "@/lib/admin/staff-totp-setup"
import type { StaffRole } from "@/lib/admin/staff-types"

const VALID_ROLES: StaffRole[] = ["admin", "tester"]

/** Loescht gespeicherte 2FA-Secrets (Admin + Tester) fuer saubere Neu-Einrichtung. */
export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  if (auth.role !== "admin") {
    return NextResponse.json(
      { error: "Nur Admins duerfen 2FA-Secrets zuruecksetzen." },
      { status: 403 }
    )
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      role?: StaffRole | "all"
    }

    if (body.role === "all" || !body.role) {
      const result = await clearAllStaff2fa()
      return NextResponse.json({
        success: true,
        cleared: result.cleared,
        message:
          "2FA fuer Admin und Tester zurueckgesetzt. Beim naechsten Login erscheint die Ersteinrichtung.",
      })
    }

    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json(
        { error: 'Ungueltige Rolle. Erlaubt: "admin", "tester", "all".' },
        { status: 400 }
      )
    }

    const account = await clearStaff2fa(body.role)
    if (!account) {
      return NextResponse.json(
        { error: `Kein Staff-Konto fuer Rolle "${body.role}" gefunden.` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      cleared: [body.role],
      message: `2FA fuer ${body.role} zurueckgesetzt.`,
    })
  } catch (error) {
    console.error("Admin: 2FA-Clear fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "2FA-Secrets konnten nicht geloescht werden." },
      { status: 500 }
    )
  }
}
