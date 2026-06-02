"use client"

import { useCallback, useEffect, useState } from "react"
import {
  applySiteTheme,
  resolveSiteTheme,
  toggleSiteTheme,
  type SiteTheme,
} from "@/lib/dripforge/site-theme"

export function useSiteTheme() {
  const [theme, setTheme] = useState<SiteTheme>("dark")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const initial = resolveSiteTheme()
    setTheme(initial)
    applySiteTheme(initial)
    setHydrated(true)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((current) => toggleSiteTheme(current))
  }, [])

  return { theme, hydrated, toggleTheme, isDark: theme === "dark" }
}
