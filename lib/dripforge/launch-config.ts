/** Offizieller Launch: 1. August 2026, 00:00 (lokale Zeit des Browsers / Server). */
export const LAUNCH_DATE = new Date(2026, 7, 1, 0, 0, 0, 0)

export const LAUNCH_DATE_ISO = "2026-08-01T00:00:00"

export const PREVIEW_ACCESS_COOKIE = "dripforge_preview_access"

export const DEFAULT_TESTER_PASSWORD = "DripForgeTest2026!"

/** Tester-Passwort (Azure/GitHub: NEXT_PUBLIC_TESTER_PASSWORD). */
export function getTesterPassword(): string {
  return (
    process.env.NEXT_PUBLIC_TESTER_PASSWORD ??
    process.env.PREVIEW_ACCESS_PASSWORD ??
    DEFAULT_TESTER_PASSWORD
  )
}

import { getCountdownForTarget } from "@/lib/dripforge/countdown-settings"

export function getLaunchCountdown(now = Date.now()) {
  return getCountdownForTarget(LAUNCH_DATE, now)
}
