import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import {
  DEFAULT_THANKS_PAGE_SETTINGS,
  normalizeThanksPageSettings,
} from "@/lib/dripforge/thanks-page-settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(normalizeThanksPageSettings(settings.thanksPage), {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    })
  } catch {
    return NextResponse.json(DEFAULT_THANKS_PAGE_SETTINGS)
  }
}
