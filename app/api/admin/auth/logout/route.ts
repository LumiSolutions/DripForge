import { NextResponse } from "next/server"
import {
  ADMIN_PENDING_COOKIE,
  ADMIN_SESSION_COOKIE,
  clearAdminSessionCookieOptions,
} from "@/lib/admin/admin-session"

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(ADMIN_SESSION_COOKIE, "", clearAdminSessionCookieOptions())
  response.cookies.set(ADMIN_PENDING_COOKIE, "", clearAdminSessionCookieOptions())
  return response
}
