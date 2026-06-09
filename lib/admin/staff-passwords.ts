import { ADMIN_PASSWORD } from "@/lib/admin/admin-auth"
import { getTesterPassword } from "@/lib/dripforge/launch-config"
import type { StaffRole } from "@/lib/admin/staff-types"

/** Serverseitiges Admin-Passwort (bevorzugt ADMIN_PASSWORD, Fallback NEXT_PUBLIC_). */
export function getAdminPasswordFromEnv(): string {
  return (
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() ||
    ADMIN_PASSWORD
  )
}

export function getStaffPasswordFromEnv(role: StaffRole): string {
  return role === "admin" ? getAdminPasswordFromEnv() : getTesterPassword()
}
