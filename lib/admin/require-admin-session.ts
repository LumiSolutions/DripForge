import { NextResponse } from "next/server"
import { getAdminSessionFromRequest } from "@/lib/admin/admin-session"
import { normalizeStaffRole, type StaffRole } from "@/lib/admin/staff-types"

export type VerifiedAdminSession = {
  userId: StaffRole
  role: StaffRole
}

function unauthorized(message: string, status = 401): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export function requireAdminSession(
  request: Request
): VerifiedAdminSession | NextResponse {
  const payload = getAdminSessionFromRequest(request)
  if (!payload?.twoFactorVerified) {
    return unauthorized(
      "Nicht autorisiert. 2FA-verifizierte Admin-Session erforderlich."
    )
  }
  const role = normalizeStaffRole(payload.role) ?? normalizeStaffRole(payload.userId)
  if (role !== "admin") {
    return unauthorized(
      "Nur Administratoren haben Zugriff auf diesen Bereich.",
      403
    )
  }
  return { userId: "admin", role: "admin" }
}

export function requireStaffTwoFactorSession(
  request: Request,
  allowedRoles: StaffRole[] = ["admin", "tester"]
): VerifiedAdminSession | NextResponse {
  const payload = getAdminSessionFromRequest(request)
  if (!payload?.twoFactorVerified) {
    return unauthorized(
      "Nicht autorisiert. 2FA-verifizierte Session erforderlich."
    )
  }
  const role = normalizeStaffRole(payload.role) ?? normalizeStaffRole(payload.userId)
  if (!role || !allowedRoles.includes(role)) {
    return unauthorized("Keine Berechtigung für diese Aktion.", 403)
  }
  return { userId: role, role }
}

export function isAuthError(
  result: VerifiedAdminSession | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
