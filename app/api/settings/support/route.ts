import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { buildSupportPageSettings } from "@/lib/dripforge/support-page-settings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(buildSupportPageSettings(settings), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (error) {
    console.error("Support-Settings API: Laden fehlgeschlagen.", error)
    return NextResponse.json(buildSupportPageSettings(null), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  }
}
