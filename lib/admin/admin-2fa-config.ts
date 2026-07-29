/**
 * Admin/Tester-2FA kann lokal oder bei Lockout temporär abgeschaltet werden.
 * Default: aktiv. Deaktivieren: ENABLE_ADMIN_2FA=false|0|off|no
 */
export function isAdmin2faEnabled(): boolean {
  const value = process.env.ENABLE_ADMIN_2FA?.trim().toLowerCase()
  if (!value) return true
  return !(value === "false" || value === "0" || value === "off" || value === "no")
}
