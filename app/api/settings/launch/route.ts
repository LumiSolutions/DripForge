import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSettings } from "@/lib/admin/db"
import {
  LAUNCH_DATE_ISO,
  PREVIEW_ACCESS_COOKIE,
} from "@/lib/dripforge/launch-config"
import { logCosmosError } from "@/lib/cosmos/log-error"

export async function GET() {
  const cookieStore = await cookies()
  const previewCookie = cookieStore.get(PREVIEW_ACCESS_COOKIE)
  const hasPreviewAccess = previewCookie?.value === "true"

  try {
    const settings = await getSettings()

    return NextResponse.json({
      shopLive: settings.launch.shopLive,
      launchAt: LAUNCH_DATE_ISO,
      previewMode: !settings.launch.shopLive,
      hasPreviewAccess,
      canAccessShop: settings.launch.shopLive || hasPreviewAccess,
    })
  } catch (error) {
    logCosmosError("launch-api:getSettings", error)

    return NextResponse.json({
      shopLive: false,
      launchAt: LAUNCH_DATE_ISO,
      previewMode: true,
      hasPreviewAccess,
      canAccessShop: hasPreviewAccess,
      degraded: true,
    })
  }
}
