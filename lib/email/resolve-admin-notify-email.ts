import type { AdminSettings } from "@/lib/admin/types"
import { getAdminResetEmail } from "@/lib/admin/staff-emails"

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/** Zieladresse für Admin-Benachrichtigungen (z. B. shop@dripforge.ch). */
export function resolveAdminNotifyEmail(settings?: AdminSettings): string | null {
  const fromEnv =
    stripEnvQuotes(process.env.ADMIN_NOTIFY_EMAIL ?? "") ||
    stripEnvQuotes(process.env.ADMIN_EMAIL ?? "") ||
    stripEnvQuotes(process.env.SMTP_USER ?? "") ||
    getAdminResetEmail()

  if (fromEnv) return fromEnv

  const fromSettings = settings?.company.kontaktEmail?.trim()
  if (fromSettings) return fromSettings

  // Festes Fallback — Bestell-/Offerten-Benachrichtigungen sollen ankommen
  return "shop@dripforge.ch"
}
