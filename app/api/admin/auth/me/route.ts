import { NextResponse } from "next/server"
import { getAdminSessionFromRequest } from "@/lib/admin/admin-session"
import { getStaffById } from "@/lib/admin/staff-db"

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request)
  if (!session?.twoFactorVerified) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const account = await getStaffById(session.userId)

  return NextResponse.json({
    authenticated: true,
    role: session.role,
    totpEnabled: Boolean(account?.totpEnabled),
  })
}
