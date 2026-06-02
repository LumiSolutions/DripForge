import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSettings } from "@/lib/admin/db"
import {
  LAUNCH_DATE_ISO,
  PREVIEW_ACCESS_COOKIE,
} from "@/lib/dripforge/launch-config"

export async function GET() {
  try {
    const settings = await getSettings()
    const cookieStore = await cookies()
    const previewCookie = cookieStore.get(PREVIEW_ACCESS_COOKIE)
    const hasPreviewAccess = previewCookie?.value === "true"

    return NextResponse.json({
      shopLive: settings.launch.shopLive,
      launchAt: LAUNCH_DATE_ISO,
      previewMode: !settings.launch.shopLive,
      hasPreviewAccess,
      canAccessShop: settings.launch.shopLive || hasPreviewAccess,
    })
  } catch (error) {
    console.warn("Launch-API: Status konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Launch-Status nicht verfuegbar." },
      { status: 500 }
    )
  }
}
