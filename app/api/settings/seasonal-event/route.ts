import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import {
  normalizeSeasonalSettings,
  resolveActiveSeasonalEvent,
} from "@/lib/dripforge/seasonal-events"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const settings = await getSettings()
    const seasonal = normalizeSeasonalSettings(settings.seasonal)
    return NextResponse.json({
      seasonal,
      activeEvent: resolveActiveSeasonalEvent(seasonal),
    })
  } catch (error) {
    console.error("Public API: Saison-Event konnte nicht geladen werden.", error)
    return NextResponse.json({ seasonal: null, activeEvent: null })
  }
}
