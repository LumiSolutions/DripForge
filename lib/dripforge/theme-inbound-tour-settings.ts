export const THEME_DRIP_STORAGE_KEY = "dripforge_theme_drip_seen"

/** Fallback, wenn im Admin noch kein Bild hochgeladen wurde */
export const THEME_DRIP_OVERLAY_SRC = "/images/drip-overlay.svg"

export const DEFAULT_ONBOARDING_TOUR_TEXT = "Tag-\noder\nNachtmodus?"

export type ThemeInboundTourPublicSettings = {
  enableOnboardingTour: boolean
  onboardingTourText: string
  themeInboundTourImageUrl: string
}

/** Standard: Tour aktiv, bis im Admin deaktiviert */
export function normalizeEnableOnboardingTour(value: unknown): boolean {
  return value !== false
}

export function normalizeOnboardingTourText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value !== "string") return ""
  return value.trim().slice(0, 200)
}

/** @deprecated Legacy-Feld — nur noch beim Lesen aus Cosmos */
export function normalizeEnableThemeInboundTour(value: unknown): boolean {
  return normalizeEnableOnboardingTour(value)
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
  enableOnboardingTour?: unknown
  enableThemeInboundTour?: unknown
  onboardingTourText?: unknown
  themeInboundTourImageUrl?: unknown
} | null): ThemeInboundTourPublicSettings {
  const enabledRaw =
    input?.enableOnboardingTour !== undefined
      ? input.enableOnboardingTour
      : input?.enableThemeInboundTour

  return {
    enableOnboardingTour: normalizeEnableOnboardingTour(enabledRaw),
    onboardingTourText: normalizeOnboardingTourText(input?.onboardingTourText),
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
