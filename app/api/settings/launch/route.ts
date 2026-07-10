import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSettings } from "@/lib/admin/db"
import { PREVIEW_ACCESS_COOKIE } from "@/lib/dripforge/launch-config"
import { buildPublicCountdownConfig } from "@/lib/dripforge/countdown-settings"
import { buildSupportPageSettings } from "@/lib/dripforge/support-page-settings"
import { logCosmosError } from "@/lib/cosmos/log-error"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const cookieStore = await cookies()
  const previewCookie = cookieStore.get(PREVIEW_ACCESS_COOKIE)
  const hasPreviewAccess = previewCookie?.value === "true"

  try {
    const settings = await getSettings()
    const support = buildSupportPageSettings(settings)
    const countdown = buildPublicCountdownConfig(settings.launch)

    return NextResponse.json(
      {
        shopLive: settings.launch.shopLive,
        launchAt: countdown.targetAt,
        previewMode: !settings.launch.shopLive,
        hasPreviewAccess,
        canAccessShop: settings.launch.shopLive || hasPreviewAccess,
        showSupportOnMainSite: support.showSupportOnMainSite,
        showSupportOnCountdownPage: support.showSupportOnCountdownPage,
        countdown,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    )
  } catch (error) {
    logCosmosError("launch-api:getSettings", error)
    const countdown = buildPublicCountdownConfig(null)

    return NextResponse.json({
      shopLive: false,
      launchAt: countdown.targetAt,
      previewMode: true,
      hasPreviewAccess,
      canAccessShop: hasPreviewAccess,
      showSupportOnMainSite: false,
      showSupportOnCountdownPage: false,
      countdown,
      degraded: true,
    })
  }
}
