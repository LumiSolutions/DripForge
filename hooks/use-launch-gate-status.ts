"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import {
  buildPublicCountdownConfig,
  shouldShowPathCountdown,
  type PublicCountdownConfig,
} from "@/lib/dripforge/countdown-settings"
import type { LaunchSettings } from "@/lib/admin/types"
import { DEFAULT_LAUNCH_SETTINGS } from "@/lib/admin/types"

export type LaunchGateStatus = {
  canAccessShop: boolean
  shopLive: boolean
  hasPreviewAccess: boolean
  canBypassCountdown: boolean
  launch: LaunchSettings
  countdown: PublicCountdownConfig
  showGlobalCountdown: boolean
  showPathCountdown: boolean
}

type LaunchApiPayload = {
  canAccessShop?: boolean
  shopLive?: boolean
  hasPreviewAccess?: boolean
  canBypassCountdown?: boolean
  launch?: Partial<LaunchSettings>
  countdown?: PublicCountdownConfig
  degraded?: boolean
  error?: string
}

type LaunchGateBase = Omit<LaunchGateStatus, "showGlobalCountdown" | "showPathCountdown">

export function useLaunchGateStatus(): {
  status: LaunchGateStatus | null
  loading: boolean
  reload: () => Promise<void>
} {
  const pathname = usePathname() ?? "/"
  const [baseStatus, setBaseStatus] = useState<LaunchGateBase | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/launch", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as LaunchApiPayload

      if (!res.ok && !data.canAccessShop && !data.hasPreviewAccess) {
        console.warn("Launch-Gate: API-Fehler.", data.error ?? res.status)
      }

      const hasPreviewAccess = Boolean(data.hasPreviewAccess)
      const shopLive = Boolean(data.shopLive)
      const canBypassCountdown = Boolean(data.canBypassCountdown)
      const canAccessShop =
        Boolean(data.canAccessShop) || hasPreviewAccess || shopLive

      setBaseStatus({
        canAccessShop,
        shopLive,
        hasPreviewAccess,
        canBypassCountdown,
        launch: { ...DEFAULT_LAUNCH_SETTINGS, ...data.launch },
        countdown: data.countdown ?? buildPublicCountdownConfig(data.launch),
      })
    } catch (err) {
      console.warn("Launch-Gate: Status konnte nicht geladen werden.", err)
      setBaseStatus({
        canAccessShop: false,
        shopLive: false,
        hasPreviewAccess: false,
        canBypassCountdown: false,
        launch: { ...DEFAULT_LAUNCH_SETTINGS },
        countdown: buildPublicCountdownConfig(null),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const status = useMemo((): LaunchGateStatus | null => {
    if (!baseStatus) return null
    const showGlobalCountdown = !baseStatus.canAccessShop
    const showPathCountdown =
      !showGlobalCountdown &&
      shouldShowPathCountdown(pathname, baseStatus.launch, {
        canBypass: baseStatus.canBypassCountdown,
      })

    return {
      ...baseStatus,
      showGlobalCountdown,
      showPathCountdown,
    }
  }, [baseStatus, pathname])

  return { status, loading, reload }
}
