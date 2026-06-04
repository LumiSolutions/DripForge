import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { getSafeServiceVisibility } from "@/lib/admin/safe-defaults"

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(getSafeServiceVisibility(settings.services))
  } catch (error) {
    console.error("Services-API: Einstellungen konnten nicht geladen werden.", error)
    return NextResponse.json(getSafeServiceVisibility(null))
  }
}
