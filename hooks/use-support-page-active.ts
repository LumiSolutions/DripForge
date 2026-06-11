"use client"

import { useEffect, useState } from "react"
import { buildSupportPageSettings } from "@/lib/dripforge/support-page-settings"

export function useSupportPageActive(): boolean {
  const [active, setActive] = useState(false)

  useEffect(() => {
    void fetch("/api/settings/support", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setActive(buildSupportPageSettings(data).isSupportPageActive)
      })
      .catch(() => {
        setActive(false)
      })
  }, [])

  return active
}

export async function fetchSupportPageActive(): Promise<boolean> {
  try {
    const res = await fetch("/api/settings/support", { cache: "no-store" })
    const data = res.ok ? await res.json() : null
    return buildSupportPageSettings(data).isSupportPageActive
  } catch {
    return false
  }
}
