import { NextResponse } from "next/server"
import { PREVIEW_ACCESS_COOKIE } from "@/lib/dripforge/launch-config"
import {
  ADMIN_PENDING_COOKIE,
  ADMIN_SESSION_COOKIE,
  adminPendingCookieOptions,
  adminSessionCookieOptions,
  clearAdminSessionCookieOptions,
  createAdminPendingToken,
  createAdminSessionToken,
  getAdminPendingFromRequest,
} from "@/lib/admin/admin-session"
import { getStaffById, saveStaff } from "@/lib/admin/staff-db"
import { getTotpSetupMaterial } from "@/lib/admin/staff-totp-setup"
import { decryptTotpSecret, encryptTotpSecret } from "@/lib/admin/totp-crypto"
import { verifyTotpCode } from "@/lib/admin/totp"
import type { StaffAccount, StaffAuthIntent, StaffRole } from "@/lib/admin/staff-types"

const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 90

export function staffLoginStepResponse(
  account: StaffAccount,
  intent: StaffAuthIntent
): NextResponse {
  const response = NextResponse.json({
    success: true,
    step: account.totpEnabled ? "totp" : "setup",
    role: account.role,
    totpEnabled: account.totpEnabled,
  })

  response.cookies.set(
    ADMIN_PENDING_COOKIE,
    createAdminPendingToken({
      userId: account.id,
      role: account.role,
      intent,
    }),
    adminPendingCookieOptions()
  )

  return response
}

export async function setupTotpForPending(
  request: Request
): Promise<NextResponse> {
  const pending = getAdminPendingFromRequest(request)
  if (!pending) {
    return NextResponse.json(
      { error: "Anmeldung abgelaufen. Bitte erneut einloggen." },
      { status: 401 }
    )
  }

  const account = await getStaffById(pending.userId)
  if (!account) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden." },
      { status: 404 }
    )
  }

  if (account.totpEnabled) {
    return NextResponse.json(
      { error: "2FA ist bereits aktiv. Bitte Code eingeben." },
      { status: 400 }
    )
  }

  const { material } = await getTotpSetupMaterial(account, { persist: false })

  return NextResponse.json({
    success: true,
    qrDataUrl: material.qrDataUrl,
    secretBase32: material.secretBase32,
    isNewSecret: material.isNewSecret,
    message: material.isNewSecret
      ? "Scannen Sie den QR-Code mit Ihrer Authenticator-App und bestätigen Sie mit einem 6-stelligen Code."
      : "Bestehender QR-Code. Beide Geräte können nacheinander scannen oder den Schlüssel manuell eintragen.",
  })
}

export async function completeTotpVerification(
  request: Request,
  code: string,
  options?: { enableOnConfirm?: boolean; secretBase32?: string }
): Promise<NextResponse> {
  const pending = getAdminPendingFromRequest(request)
  if (!pending) {
    return NextResponse.json(
      { error: "Anmeldung abgelaufen. Bitte erneut einloggen." },
      { status: 401 }
    )
  }

  const account = await getStaffById(pending.userId)
  if (!account) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden." },
      { status: 404 }
    )
  }

  const providedSecret = options?.secretBase32?.replace(/\s/g, "") ?? ""
  let secret: string | null = null

  if (providedSecret) {
    secret = providedSecret
  } else if (account.totpSecretEncrypted) {
    secret = decryptTotpSecret(account.totpSecretEncrypted)
  }

  if (!secret) {
    return NextResponse.json(
      { error: "2FA ist noch nicht eingerichtet." },
      { status: 400 }
    )
  }

  if (!verifyTotpCode(secret, code)) {
    return NextResponse.json(
      { error: "Ungueltiger Verifizierungscode." },
      { status: 401 }
    )
  }

  const enableOnConfirm = options?.enableOnConfirm ?? !account.totpEnabled
  if (enableOnConfirm) {
    await saveStaff({
      ...account,
      totpSecretEncrypted: encryptTotpSecret(secret),
      totpEnabled: true,
    })
  }

  return finalizeStaffAuth(pending.role, pending.intent)
}

export function finalizeStaffAuth(
  role: StaffRole,
  intent: StaffAuthIntent
): NextResponse {
  if (intent === "preview" && role !== "tester" && role !== "admin") {
    return NextResponse.json(
      { error: "Keine Berechtigung fuer Vorschau-Zugang." },
      { status: 403 }
    )
  }

  if (intent === "admin" && role !== "admin") {
    return NextResponse.json(
      { error: "Nur Administratoren haben Zugriff auf den Admin-Bereich." },
      { status: 403 }
    )
  }

  const response =
    intent === "preview"
      ? NextResponse.json({
          success: true,
          message: "Vorschau-Zugang freigeschaltet.",
        })
      : NextResponse.json({
          success: true,
          message: "Anmeldung erfolgreich.",
          role,
        })

  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    createAdminSessionToken({
      userId: role,
      role,
      twoFactorVerified: true,
    }),
    adminSessionCookieOptions()
  )

  response.cookies.set(ADMIN_PENDING_COOKIE, "", clearAdminSessionCookieOptions())

  if (intent === "preview") {
    response.cookies.set(PREVIEW_ACCESS_COOKIE, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PREVIEW_COOKIE_MAX_AGE,
    })
  }

  return response
}
