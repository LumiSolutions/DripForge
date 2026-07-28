import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { buildDefaultAdminSettings } from "@/lib/admin/safe-defaults"

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(settings.company)
  } catch (error) {
    console.error("Shop-API: Firmendaten nicht verfügbar.", error)
    return NextResponse.json(buildDefaultAdminSettings().company)
  }
}
