import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import {
  DEFAULT_ANNOUNCEMENT_BANNER,
  normalizeAnnouncementBanner,
} from "@/lib/dripforge/announcement-banner-settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(
      normalizeAnnouncementBanner(settings.announcementBanner),
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    )
  } catch {
    return NextResponse.json(DEFAULT_ANNOUNCEMENT_BANNER)
  }
}
