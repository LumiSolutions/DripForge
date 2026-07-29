import { NextResponse } from "next/server"
import { isAdmin2faEnabled } from "@/lib/admin/admin-2fa-config"
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
import {
  getTotpSetupMaterial,
  loadStaffTotpSecret,
  staffHasPersistedTotpSecret,
} from "@/lib/admin/staff-totp-setup"
import { encryptTotpSecret } from "@/lib/admin/totp-crypto"
import { verifyTotpCode } from "@/lib/admin/totp"
import type { StaffAccount, StaffAuthIntent, StaffRole } from "@/lib/admin/staff-types"

const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 90

/** True wenn Verify-Schritt möglich ist (aktiv + entschlüsselbares Secret). */
export function staffCanVerifyTotp(account: StaffAccount): boolean {
  return account.totpEnabled && staffHasPersistedTotpSecret(account)
}

export function staffLoginStepResponse(
  account: StaffAccount,
  intent: StaffAuthIntent
): NextResponse {
  const canVerify = staffCanVerifyTotp(account)
  const response = NextResponse.json({
    success: true,
    step: canVerify ? "totp" : "setup",
    role: account.role,
    totpEnabled: account.totpEnabled,
    needsTotpSetup: !canVerify,
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

/**
 * Nach Passwort: 2FA-Schritt oder — wenn ENABLE_ADMIN_2FA=false — sofort Session.
 */
export function staffLoginAfterPassword(
  account: StaffAccount,
  intent: StaffAuthIntent
): NextResponse {
  if (!isAdmin2faEnabled()) {
    return finalizeStaffAuth(account.role, intent)
  }
  return staffLoginStepResponse(account, intent)
}

export async function setupTotpForPending(
  request: Request
): Promise<NextResponse> {
  if (!isAdmin2faEnabled()) {
    return NextResponse.json(
      { error: "2FA ist per ENABLE_ADMIN_2FA deaktiviert." },
      { status: 400 }
    )
  }

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

  if (staffCanVerifyTotp(account)) {
    return NextResponse.json(
      { error: "2FA ist bereits aktiv. Bitte Code eingeben." },
      { status: 400 }
    )
  }

  // totpEnabled ohne lesbares Secret → Secret neu erzeugen und QR anzeigen
  const forceNew =
    Boolean(account.totpSecretEncrypted) && !staffHasPersistedTotpSecret(account)

  const { material } = await getTotpSetupMaterial(account, { forceNew })

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
  if (!isAdmin2faEnabled()) {
    const pending = getAdminPendingFromRequest(request)
    if (!pending) {
      return NextResponse.json(
        { error: "Anmeldung abgelaufen. Bitte erneut einloggen." },
        { status: 401 }
      )
    }
    return finalizeStaffAuth(pending.role, pending.intent)
  }

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
  let secret = loadStaffTotpSecret(account)

  if (!secret && providedSecret) {
    secret = providedSecret
  }

  if (!secret) {
    return NextResponse.json(
      {
        error:
          "2FA ist noch nicht eingerichtet. Bitte QR-Code scannen und Setup abschliessen.",
        needsTotpSetup: true,
      },
      { status: 400 }
    )
  }

  if (!verifyTotpCode(secret, code)) {
    return NextResponse.json(
      { error: "Ungültiger Verifizierungscode." },
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
      { error: "Keine Berechtigung für Vorschau-Zugang." },
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
