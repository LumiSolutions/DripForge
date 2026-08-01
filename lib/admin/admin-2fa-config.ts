import { getSettings } from "@/lib/admin/db"

/**
 * Env-Kill-Switch: ENABLE_ADMIN_2FA=false|0|off|no erzwingt deaktivierte 2FA
 * (z. B. Lockout), unabhängig vom Admin-Toggle.
 */
export function isAdmin2faEnvDisabled(): boolean {
  const value = process.env.ENABLE_ADMIN_2FA?.trim().toLowerCase()
  if (!value) return false
  return value === "false" || value === "0" || value === "off" || value === "no"
}

/** Sync-Fallback (nur Env). Bevorzugt {@link isAdmin2faEnabled}. */
export function isAdmin2faEnabledSync(): boolean {
  return !isAdmin2faEnvDisabled()
}

/**
 * 2FA aktiv wenn Env nicht deaktiviert und AdminSettings.requireAdmin2fa !== false.
 */
export async function isAdmin2faEnabled(): Promise<boolean> {
  if (isAdmin2faEnvDisabled()) return false
  try {
    const settings = await getSettings()
    return settings.requireAdmin2fa !== false
  } catch {
    return true
  }
}

export function normalizeRequireAdmin2fa(value: unknown): boolean {
  if (value === false) return false
  return true
}
