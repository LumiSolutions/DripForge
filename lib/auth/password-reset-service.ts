import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { getAdminResetEmail, resolveStaffRoleByEmail } from "@/lib/admin/staff-emails"
import { getStaffById, saveStaff } from "@/lib/admin/staff-db"
import { createPasswordResetToken } from "@/lib/auth/password-reset-token"
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset"
import { getAccountByEmail, saveAccount } from "@/lib/konto/account-db"

const GENERIC_SUCCESS =
  "Falls ein Konto mit dieser E-Mail existiert, erhalten Sie in Kuerze einen Link zum Zuruecksetzen."

const TESTER_BLOCKED =
  "Tester-Passwoerter koennen aus Sicherheitsgruenden nicht per E-Mail zurueckgesetzt werden. Bitte wenden Sie sich an einen Administrator."

function buildResetUrl(origin: string, path: string, token: string): string {
  const base = origin.replace(/\/$/, "")
  return `${base}${path}?token=${encodeURIComponent(token)}`
}

export type ForgotPasswordResult =
  | { ok: true; message: string }
  | { ok: false; message: string; blocked?: boolean }

export async function requestPasswordReset(
  email: string,
  origin: string
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
    const resetUrl = buildResetUrl(
      origin,
      adminPortalPath("/passwort-zuruecksetzen"),
      token
    )
    await sendPasswordResetEmail({
      to: adminEmail,
      resetUrl,
      accountLabel: "Admin",
    })

    return { ok: true, message: GENERIC_SUCCESS }
  }

  const customer = await getAccountByEmail(normalized)
  if (!customer) {
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

  const resetUrl = buildResetUrl(origin, "/konto/passwort-zuruecksetzen", token)
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
