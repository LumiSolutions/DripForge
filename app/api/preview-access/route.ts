import { NextResponse } from "next/server"
import { PREVIEW_ACCESS_COOKIE } from "@/lib/dripforge/launch-config"
import { staffLoginAfterPassword } from "@/lib/admin/staff-auth"
import { verifyStaffPassword } from "@/lib/admin/staff-db"
import { getAdminSessionFromRequest } from "@/lib/admin/admin-session"

const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 90

/**
 * Tester-Vorschau: Schritt 1 (Passwort).
 * TOTP-Schritte laufen über /api/admin/auth/* (setup-totp, confirm-totp, verify-totp).
 */
export async function POST(request: Request) {
  try {
    const session = getAdminSessionFromRequest(request)
    if (session?.twoFactorVerified && session.role === "tester") {
      const response = NextResponse.json({
        success: true,
        message: "Vorschau-Zugang bereits aktiv.",
      })
      response.cookies.set(PREVIEW_ACCESS_COOKIE, "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: PREVIEW_COOKIE_MAX_AGE,
      })
      return response
    }

    const body = (await request.json()) as { password?: string }
    const password = body.password?.trim() ?? ""

    if (!password) {
      return NextResponse.json({ error: "Passwort fehlt." }, { status: 400 })
    }

    const account = await verifyStaffPassword("tester", password)
    if (!account) {
      return NextResponse.json(
        { error: "Falsches Tester-Passwort." },
        { status: 401 }
      )
    }

    return staffLoginAfterPassword(account, "preview")
  } catch (error) {
    console.error("Preview-Access: Anmeldung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Anmeldung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
