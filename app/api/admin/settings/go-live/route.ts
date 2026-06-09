import { NextResponse } from "next/server"
import { setShopLive } from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const settings = await setShopLive(true)
    return NextResponse.json({
      success: true,
      launch: settings.launch,
      message: "Website ist jetzt offiziell live.",
    })
  } catch (error) {
    console.warn("Admin-API: Live-Schaltung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Live-Schaltung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
