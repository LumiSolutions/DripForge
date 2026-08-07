import { NextResponse } from "next/server"
import { getSettings, saveSettings } from "@/lib/admin/db"
import {
  normalizeSeasonalSettings,
  resolveActiveSeasonalEvent,
} from "@/lib/dripforge/seasonal-events"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  const settings = await getSettings()
  const seasonal = normalizeSeasonalSettings(settings.seasonal)
  return NextResponse.json({
    seasonal,
    activeEvent: resolveActiveSeasonalEvent(seasonal),
  })
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const current = await getSettings()
    const seasonal = normalizeSeasonalSettings(body?.seasonal ?? body)
    const saved = await saveSettings({
      checkout: current.checkout,
      seasonal,
    })
    const normalized = normalizeSeasonalSettings(saved.seasonal)
    return NextResponse.json({
      seasonal: normalized,
      activeEvent: resolveActiveSeasonalEvent(normalized),
    })
  } catch (error) {
    console.error("Admin-API: Saison-Einstellungen konnten nicht gespeichert werden.", error)
    return NextResponse.json(
      { error: "Saison-Einstellungen konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
