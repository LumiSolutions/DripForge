import { normalizeCustomerEmail } from "@/lib/admin/customers"
import type { StaffRole } from "@/lib/admin/staff-types"

export function getAdminResetEmail(): string | null {
  const raw =
    process.env.ADMIN_RESET_EMAIL?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    null
  return raw ? normalizeCustomerEmail(raw) : null
}

export function getTesterResetEmail(): string | null {
  const raw =
    process.env.TESTER_RESET_EMAIL?.trim() ||
    process.env.TESTER_EMAIL?.trim() ||
    null
  return raw ? normalizeCustomerEmail(raw) : null
}

export function resolveStaffRoleByEmail(email: string): StaffRole | null {
  const normalized = normalizeCustomerEmail(email)
  if (!normalized) return null

  const adminEmail = getAdminResetEmail()
  if (adminEmail && normalized === adminEmail) return "admin"

  const testerEmail = getTesterResetEmail()
  if (testerEmail && normalized === testerEmail) return "tester"

  return null
}
