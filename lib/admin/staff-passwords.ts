import { getAdminPassword } from "@/lib/admin/admin-auth"
import { getTesterPassword } from "@/lib/dripforge/launch-config"
import type { StaffRole } from "@/lib/admin/staff-types"

/** Serverseitiges Admin-Passwort (nur ENV, kein Repo-Fallback). */
export function getAdminPasswordFromEnv(): string {
  return getAdminPassword()
}

export function getStaffPasswordFromEnv(role: StaffRole): string {
  return role === "admin" ? getAdminPasswordFromEnv() : getTesterPassword()
}

/** True wenn für die Rolle ein nicht-leeres ENV-Passwort gesetzt ist. */
export function hasStaffPasswordInEnv(role: StaffRole): boolean {
  return getStaffPasswordFromEnv(role).length > 0
}
