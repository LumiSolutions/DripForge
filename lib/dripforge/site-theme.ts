import { safeLocalGet, safeLocalSet } from "@/lib/dripforge/safe-storage"

export type SiteTheme = "light" | "dark"

const STORAGE_KEY = "theme"

export function getStoredSiteTheme(): SiteTheme | null {
  if (typeof window === "undefined") return null
  const saved = safeLocalGet(STORAGE_KEY)
  return saved === "light" || saved === "dark" ? saved : null
}

export function resolveSiteTheme(): SiteTheme {
  if (typeof window === "undefined") return "dark"
  const saved = getStoredSiteTheme()
  if (saved) return saved
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function applySiteTheme(theme: SiteTheme): void {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("dark", theme === "dark")
  safeLocalSet(STORAGE_KEY, theme)
}

export function toggleSiteTheme(current: SiteTheme): SiteTheme {
  const next = current === "dark" ? "light" : "dark"
  applySiteTheme(next)
  return next
}
