import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { buildSupportPageSettings } from "@/lib/dripforge/support-page-settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const settings = await getSettings()
    const support = buildSupportPageSettings(settings)

    return NextResponse.json(
      {
        showSupportOnMainSite:
          settings.showSupportOnMainSite === true || support.showSupportOnMainSite,
        showSupportOnCountdownPage:
          settings.showSupportOnCountdownPage === true ||
          support.showSupportOnCountdownPage,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    )
  } catch (error) {
    console.error("Support-Settings API: Laden fehlgeschlagen.", error)
    return NextResponse.json(buildSupportPageSettings(null), {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    })
  }
}
