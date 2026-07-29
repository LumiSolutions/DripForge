import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { getAdminResetEmail, resolveStaffRoleByEmail } from "@/lib/admin/staff-emails"
import { getStaffById, saveStaff } from "@/lib/admin/staff-db"
import { createPasswordResetToken } from "@/lib/auth/password-reset-token"
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset"
import { getAccountByEmail, saveAccount, isActiveCustomerAccount } from "@/lib/konto/account-db"
import { resolveSiteOrigin } from "@/lib/site/site-origin"

const GENERIC_SUCCESS =
  "Falls ein Konto mit dieser E-Mail existiert, erhalten Sie in Kuerze einen Link zum Zurücksetzen."

const TESTER_BLOCKED =
  "Tester-Passwörter können aus Sicherheitsgruenden nicht per E-Mail zurückgesetzt werden. Bitte wenden Sie sich an einen Administrator."

/** Kunden-Reset-Pfad (ASCII, wie App-Route). */
const CUSTOMER_RESET_PATH = "/konto/passwort-zuruecksetzen"
/** Admin-Reset-Pfad (ASCII, wie App-Route). */
const ADMIN_RESET_PATH = adminPortalPath("/passwort-zuruecksetzen")

function buildResetUrl(path: string, token: string): string {
  const base = resolveSiteOrigin()
  return `${base}${path}?token=${encodeURIComponent(token)}`
}

export type ForgotPasswordResult =
  | { ok: true; message: string }
  | { ok: false; message: string; blocked?: boolean }

/**
 * Startet Passwort-Reset und sendet E-Mail.
 * Base-URL kommt aus NEXT_PUBLIC_SITE_URL / NEXTAUTH_URL (nie Request-Host).
 */
export async function requestPasswordReset(
  email: string,
  _originIgnored?: string
): Promise<ForgotPasswordResult> {
  const normalized = normalizeCustomerEmail(email)
  if (!normalized) {
    return { ok: true, message: GENERIC_SUCCESS }
  }

  const staffRole = resolveStaffRoleByEmail(normalized)

  if (staffRole === "tester") {
    return { ok: false, message: TESTER_BLOCKED, blocked: true }
  }

  if (staffRole === "admin") {
    const account = await getStaffById("admin")
    if (!account) {
      return { ok: true, message: GENERIC_SUCCESS }
    }

    const { token, hash, expiresAt } = createPasswordResetToken({
      type: "admin",
      accountId: "admin",
    })

    await saveStaff({
      ...account,
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: expiresAt,
    })

    const adminEmail = getAdminResetEmail() ?? normalized
    const resetUrl = buildResetUrl(ADMIN_RESET_PATH, token)
    await sendPasswordResetEmail({
      to: adminEmail,
      resetUrl,
      accountLabel: "Admin",
    })

    return { ok: true, message: GENERIC_SUCCESS }
  }

  const customer = await getAccountByEmail(normalized)
  if (!customer || !isActiveCustomerAccount(customer)) {
    return { ok: true, message: GENERIC_SUCCESS }
  }

  const { token, hash, expiresAt } = createPasswordResetToken({
    type: "customer",
    accountId: normalized,
  })

  await saveAccount({
    ...customer,
    passwordResetTokenHash: hash,
    passwordResetExpiresAt: expiresAt,
  })

  const resetUrl = buildResetUrl(CUSTOMER_RESET_PATH, token)
  await sendPasswordResetEmail({
    to: normalized,
    resetUrl,
    accountLabel: "Kunden",
  })

  return { ok: true, message: GENERIC_SUCCESS }
}

export function clearPasswordResetFields<T extends {
  passwordResetTokenHash?: string | null
  passwordResetExpiresAt?: string | null
}>(account: T): T {
  return {
    ...account,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
  }
}
