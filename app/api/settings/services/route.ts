import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { normalizeServiceVisibility } from "@/lib/dripforge/service-visibility"

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(normalizeServiceVisibility(settings.services))
  } catch (error) {
    console.error("Services-API: Einstellungen konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Service-Einstellungen nicht verfügbar." },
      { status: 500 }
    )
  }
}
