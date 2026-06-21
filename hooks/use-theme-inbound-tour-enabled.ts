"use client"

import { useCallback, useEffect, useState } from "react"
import {
  buildThemeInboundTourPublicSettings,
  type ThemeInboundTourPublicSettings,
} from "@/lib/dripforge/theme-inbound-tour-settings"

/** Alle 15s + bei Tab-Fokus — Admin-Änderungen ohne Reload sichtbar */
const REFRESH_MS = 15_000

const DEFAULT_SETTINGS = buildThemeInboundTourPublicSettings(null)

async function loadThemeTourSettingsFromApi(): Promise<ThemeInboundTourPublicSettings> {
  const cacheBust = Date.now()
  try {
    const res = await fetch(`/api/settings/services?_=${cacheBust}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    })
    if (res.ok) {
      return buildThemeInboundTourPublicSettings(await res.json())
    }
  } catch {
    /* Fallback unten */
  }
  return DEFAULT_SETTINGS
}

export function useThemeInboundTourSettings(): ThemeInboundTourPublicSettings | null {
  const [settings, setSettings] = useState<ThemeInboundTourPublicSettings | null>(
    null
  )

  const refresh = useCallback(async () => {
    setSettings(await loadThemeTourSettingsFromApi())
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

export function useThemeInboundTourEnabled(): boolean | null {
  const settings = useThemeInboundTourSettings()
  if (settings === null) return null
  return settings.enableOnboardingTour
}
