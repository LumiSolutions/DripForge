"use client"

import { useCallback, useEffect, useState } from "react"
import type { SupportPageSettings } from "@/lib/dripforge/support-page-settings"

const DEFAULT_SUPPORT_SETTINGS: SupportPageSettings = {
  showSupportOnMainSite: false,
  showSupportOnCountdownPage: false,
}

/** Alle 15s + bei Tab-Fokus — Admin-Änderungen ohne Reload sichtbar */
const REFRESH_MS = 15_000

function parseLaunchSupportPayload(data: unknown): SupportPageSettings {
  const row = data as {
    showSupportOnMainSite?: unknown
    showSupportOnCountdownPage?: unknown
    isSupportPageActive?: unknown
  } | null

  if (!row) return DEFAULT_SUPPORT_SETTINGS

  const legacy = row.isSupportPageActive === true

  return {
    showSupportOnMainSite:
      row.showSupportOnMainSite === true ||
      (row.showSupportOnMainSite !== false && legacy),
    showSupportOnCountdownPage:
      row.showSupportOnCountdownPage === true ||
      (row.showSupportOnCountdownPage !== false && legacy),
  }
}

async function loadSupportSettingsFromApi(): Promise<SupportPageSettings> {
  const cacheBust = Date.now()
  const headers = { "Cache-Control": "no-cache", Pragma: "no-cache" }

  try {
    const launchRes = await fetch(`/api/settings/launch?_=${cacheBust}`, {
      cache: "no-store",
      headers,
    })
    if (launchRes.ok) {
      return parseLaunchSupportPayload(await launchRes.json())
    }
  } catch {
    /* Fallback unten */
  }

  try {
    const supportRes = await fetch(`/api/settings/support?_=${cacheBust}`, {
      cache: "no-store",
      headers,
    })
    if (supportRes.ok) {
      const data = await supportRes.json()
      return {
        showSupportOnMainSite: data.showSupportOnMainSite === true,
        showSupportOnCountdownPage: data.showSupportOnCountdownPage === true,
      }
    }
  } catch {
    /* Defaults unten */
  }

  return DEFAULT_SUPPORT_SETTINGS
}

export function useSupportPageSettings(): SupportPageSettings {
  const [settings, setSettings] = useState<SupportPageSettings>(
    DEFAULT_SUPPORT_SETTINGS
  )

  const refresh = useCallback(async () => {
    const next = await loadSupportSettingsFromApi()
    setSettings(next)
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

/** @deprecated Nutze useSupportPageSettings().showSupportOnMainSite */
export function useSupportPageActive(): boolean {
  return useSupportPageSettings().showSupportOnMainSite
}

export async function fetchSupportPageSettings(): Promise<SupportPageSettings> {
  return loadSupportSettingsFromApi()
}

/** @deprecated Nutze fetchSupportPageSettings().showSupportOnMainSite */
export async function fetchSupportPageActive(): Promise<boolean> {
  return (await fetchSupportPageSettings()).showSupportOnMainSite
}
