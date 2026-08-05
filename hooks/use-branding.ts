"use client"

import { useEffect, useState } from "react"

export type Branding = {
  brandIconUrl: string | null
  brandLogoUrl: string | null
}

const EMPTY: Branding = { brandIconUrl: null, brandLogoUrl: null }

// Modul-Cache, damit Header/Footer/Home nicht mehrfach laden.
let cache: Branding | null = null
let inflight: Promise<Branding> | null = null

async function fetchBranding(): Promise<Branding> {
  if (cache) return cache
  if (!inflight) {
    // Server setzt s-maxage=30 — Client-Cache respektieren (kein no-store).
    inflight = fetch("/api/settings/branding")
      .then((res) => (res.ok ? res.json() : EMPTY))
      .then(
        (data): Branding => ({
          brandIconUrl:
            typeof data?.brandIconUrl === "string" ? data.brandIconUrl : null,
          brandLogoUrl:
            typeof data?.brandLogoUrl === "string" ? data.brandLogoUrl : null,
        })
      )
      .then((data) => {
        cache = data
        return data
      })
      .catch(() => EMPTY)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Nach Admin-Logo-Upload den Modul-Cache leeren. */
export function invalidateBrandingCache() {
  cache = null
  inflight = null
}

export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(cache ?? EMPTY)

  useEffect(() => {
    let cancelled = false
    void fetchBranding().then((data) => {
      if (!cancelled) setBranding(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return branding
}
