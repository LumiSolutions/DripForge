export const THEME_DRIP_STORAGE_KEY = "dripforge_theme_drip_seen"

/** Offizielle Tropfen-Grafik — bei Bedarf durch drip-overlay.png ersetzen */
export const THEME_DRIP_OVERLAY_SRC = "/images/drip-overlay.svg"

/** Standard: Tour aktiv, bis im Admin deaktiviert */
export function normalizeEnableThemeInboundTour(value: unknown): boolean {
  return value !== false
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
