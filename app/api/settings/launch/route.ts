import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSettings } from "@/lib/admin/db"
import { getAdminSessionFromRequest } from "@/lib/admin/admin-session"
import { PREVIEW_ACCESS_COOKIE } from "@/lib/dripforge/launch-config"
import {
  buildPublicCountdownConfig,
  normalizeLaunchSettings,
} from "@/lib/dripforge/countdown-settings"
import { buildSupportPageSettings } from "@/lib/dripforge/support-page-settings"
import { logCosmosError } from "@/lib/cosmos/log-error"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function resolveCanBypassCountdown(
  hasPreviewAccess: boolean,
  request: Request
): boolean {
  if (hasPreviewAccess) return true

  const adminSession = getAdminSessionFromRequest(request)
  if (!adminSession?.twoFactorVerified) return false

  return adminSession.role === "admin" || adminSession.role === "tester"
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const previewCookie = cookieStore.get(PREVIEW_ACCESS_COOKIE)
  const hasPreviewAccess = previewCookie?.value === "true"
  const canBypassCountdown = resolveCanBypassCountdown(hasPreviewAccess, request)

  try {
    const settings = await getSettings()
    const support = buildSupportPageSettings(settings)
    const launch = normalizeLaunchSettings(settings.launch)
    const countdown = buildPublicCountdownConfig(launch)

    return NextResponse.json(
      {
        shopLive: launch.shopLive,
        launchAt: countdown.targetAt,
        previewMode: !launch.shopLive,
        hasPreviewAccess,
        canBypassCountdown,
        canAccessShop: launch.shopLive || hasPreviewAccess,
        showSupportOnMainSite: support.showSupportOnMainSite,
        showSupportOnCountdownPage: support.showSupportOnCountdownPage,
        blockedPath: launch.blockedPath,
        launch,
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
      canBypassCountdown,
      canAccessShop: hasPreviewAccess,
      showSupportOnMainSite: false,
      showSupportOnCountdownPage: false,
      blockedPath: null,
      launch: normalizeLaunchSettings(null),
      countdown,
      degraded: true,
    })
  }
}
