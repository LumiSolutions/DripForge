import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { buildDefaultAdminSettings } from "@/lib/admin/safe-defaults"
import { normalizeCompanySettings } from "@/lib/dripforge/company-settings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(normalizeCompanySettings(settings.company), {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    })
  } catch (error) {
    console.error("Shop-API: Firmendaten nicht verfügbar.", error)
    return NextResponse.json(
      normalizeCompanySettings(buildDefaultAdminSettings().company)
    )
  }
}
