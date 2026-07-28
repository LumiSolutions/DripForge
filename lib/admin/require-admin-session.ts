import { NextResponse } from "next/server"
import { getAdminSessionFromRequest } from "@/lib/admin/admin-session"
import type { StaffRole } from "@/lib/admin/staff-types"

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
  if (payload.role !== "admin") {
    return unauthorized(
      "Nur Administratoren haben Zugriff auf diesen Bereich.",
      403
    )
  }
  return { userId: payload.userId, role: payload.role }
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
  if (!allowedRoles.includes(payload.role)) {
    return unauthorized("Keine Berechtigung für diese Aktion.", 403)
  }
  return { userId: payload.userId, role: payload.role }
}

export function isAuthError(
  result: VerifiedAdminSession | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
