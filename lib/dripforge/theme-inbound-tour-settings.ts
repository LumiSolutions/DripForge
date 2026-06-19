export const THEME_DRIP_STORAGE_KEY = "dripforge_theme_drip_seen"

/** Fallback, wenn im Admin noch kein Bild hochgeladen wurde */
export const THEME_DRIP_OVERLAY_SRC = "/images/drip-overlay.svg"

export type ThemeInboundTourPublicSettings = {
  enableThemeInboundTour: boolean
  themeInboundTourImageUrl: string
}

/** Standard: Tour aktiv, bis im Admin deaktiviert */
export function normalizeEnableThemeInboundTour(value: unknown): boolean {
  return value !== false
}

export function normalizeThemeInboundTourImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed
  }
  return null
}

export function resolveThemeInboundTourImageUrl(
  stored: unknown
): string {
  return normalizeThemeInboundTourImageUrl(stored) ?? THEME_DRIP_OVERLAY_SRC
}

export function buildThemeInboundTourPublicSettings(input?: {
  enableThemeInboundTour?: unknown
  themeInboundTourImageUrl?: unknown
} | null): ThemeInboundTourPublicSettings {
  return {
    enableThemeInboundTour: normalizeEnableThemeInboundTour(
      input?.enableThemeInboundTour
    ),
    themeInboundTourImageUrl: resolveThemeInboundTourImageUrl(
      input?.themeInboundTourImageUrl
    ),
  }
}

export function hasSeenThemeInboundTour(): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(THEME_DRIP_STORAGE_KEY) === "true"
}

export function markThemeInboundTourSeen(): void {
  if (typeof window === "undefined") return
  localStorage.setItem(THEME_DRIP_STORAGE_KEY, "true")
  window.dispatchEvent(new CustomEvent("dripforge:theme-tour-seen"))
}

export function shouldUseUnoptimizedThemeTourImage(src: string): boolean {
  return src.startsWith("data:") || src.endsWith(".svg")
}
