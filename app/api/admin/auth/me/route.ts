import { NextResponse } from "next/server"
import { getAdminSessionFromRequest } from "@/lib/admin/admin-session"
import { getStaffById } from "@/lib/admin/staff-db"
import { normalizeStaffRole } from "@/lib/admin/staff-types"

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request)
  if (!session?.twoFactorVerified) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const role =
    normalizeStaffRole(session.role) ?? normalizeStaffRole(session.userId)
  if (!role) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const account = await getStaffById(role)

  return NextResponse.json({
    authenticated: true,
    role,
    totpEnabled: Boolean(account?.totpEnabled),
  })
}
