"use client"

import { useCallback, useEffect, useState } from "react"
import { normalizeEnableThemeInboundTour } from "@/lib/dripforge/theme-inbound-tour-settings"

/** Alle 15s + bei Tab-Fokus — Admin-Änderungen ohne Reload sichtbar */
const REFRESH_MS = 15_000

async function loadThemeTourEnabledFromApi(): Promise<boolean> {
  const cacheBust = Date.now()
  try {
    const res = await fetch(`/api/settings/services?_=${cacheBust}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    })
    if (res.ok) {
      const data = (await res.json()) as { enableThemeInboundTour?: unknown }
      return normalizeEnableThemeInboundTour(data.enableThemeInboundTour)
    }
  } catch {
    /* Fallback unten */
  }
  return true
}

export function useThemeInboundTourEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  const refresh = useCallback(async () => {
    setEnabled(await loadThemeTourEnabledFromApi())
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

  return enabled
}
