import type { AdminSettings } from "@/lib/admin/types"
import { getAdminResetEmail } from "@/lib/admin/staff-emails"

/** Zieladresse für Admin-Benachrichtigungen (z. B. info@dripforge.ch). */
export function resolveAdminNotifyEmail(settings?: AdminSettings): string | null {
  const fromEnv =
    process.env.ADMIN_NOTIFY_EMAIL?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    getAdminResetEmail()

  if (fromEnv) return fromEnv

  const fromSettings = settings?.company.kontaktEmail?.trim()
  return fromSettings || null
}
