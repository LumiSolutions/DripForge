"use client"

import { useCallback, useEffect, useState } from "react"
import {
  buildRewardPointsPublicSettings,
  type RewardPointsPublicSettings,
} from "@/lib/dripforge/reward-points-settings"

const REFRESH_MS = 15_000

const DEFAULT_SETTINGS = buildRewardPointsPublicSettings(null)

async function loadRewardPointsSettingsFromApi(): Promise<RewardPointsPublicSettings> {
  const cacheBust = Date.now()
  try {
    const res = await fetch(`/api/settings/services?_=${cacheBust}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    })
    if (res.ok) {
      return buildRewardPointsPublicSettings(await res.json())
    }
  } catch {
    /* Fallback unten */
  }
  return DEFAULT_SETTINGS
}

export function useRewardPointsSettings(): RewardPointsPublicSettings | null {
  const [settings, setSettings] = useState<RewardPointsPublicSettings | null>(
    null
  )

  const refresh = useCallback(async () => {
    setSettings(await loadRewardPointsSettingsFromApi())
  }, [])

  useEffect(() => {
    void refresh()

    const interval = window.setInterval(() => void refresh(), REFRESH_MS)

    const onFocus = () => void refresh()
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh()
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [refresh])

  return settings
}

export function useRewardPointsEnabled(): boolean | null {
  const settings = useRewardPointsSettings()
  if (settings === null) return null
  return settings.enableRewardPointsSystem
}
