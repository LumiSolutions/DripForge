import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { getVisitorAnalyticsSnapshot } from "@/lib/admin/visitor-sessions"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const snapshot = await getVisitorAnalyticsSnapshot()
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error("Admin visitors analytics failed.", error)
    return NextResponse.json(
      {
        onlineCount: 0,
        byRegion: [],
        generatedAt: new Date().toISOString(),
        error: "Besucherstatistik nicht verfügbar",
      },
      { status: 500 }
    )
  }
}
