"use client"

import { useEffect, useState } from "react"
import {
  buildSupportPageSettings,
  type SupportPageSettings,
} from "@/lib/dripforge/support-page-settings"

const DEFAULT_SUPPORT_SETTINGS: SupportPageSettings = {
  showSupportOnMainSite: false,
  showSupportOnCountdownPage: false,
}

export function useSupportPageSettings(): SupportPageSettings {
  const [settings, setSettings] = useState<SupportPageSettings>(
    DEFAULT_SUPPORT_SETTINGS
  )

  useEffect(() => {
    void fetch("/api/settings/support", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setSettings(buildSupportPageSettings(data))
      })
      .catch(() => {
        setSettings(DEFAULT_SUPPORT_SETTINGS)
      })
  }, [])

  return settings
}

/** @deprecated Nutze useSupportPageSettings().showSupportOnMainSite */
export function useSupportPageActive(): boolean {
  return useSupportPageSettings().showSupportOnMainSite
}

export async function fetchSupportPageSettings(): Promise<SupportPageSettings> {
  try {
    const res = await fetch("/api/settings/support", { cache: "no-store" })
    const data = res.ok ? await res.json() : null
    return buildSupportPageSettings(data)
  } catch {
    return DEFAULT_SUPPORT_SETTINGS
  }
}

/** @deprecated Nutze fetchSupportPageSettings().showSupportOnMainSite */
export async function fetchSupportPageActive(): Promise<boolean> {
  return (await fetchSupportPageSettings()).showSupportOnMainSite
}
