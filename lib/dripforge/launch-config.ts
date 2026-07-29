import { readEnvSecret } from "@/lib/security/env-secrets"

/** Offizieller Launch: 1. August 2026, 00:00 (lokale Zeit des Browsers / Server). */
export const LAUNCH_DATE = new Date(2026, 7, 1, 0, 0, 0, 0)

export const LAUNCH_DATE_ISO = "2026-08-01T00:00:00"

export const PREVIEW_ACCESS_COOKIE = "dripforge_preview_access"

/**
 * Preview-Zugangspasswort ausschliesslich aus ENV.
 * Kein hartkodierter Fallback.
 */
export function getPreviewAccessPassword(): string {
  return process.env.PREVIEW_ACCESS_PASSWORD?.trim() || ""
}

/**
 * Tester-/Preview-Passwort ausschliesslich aus ENV.
 * Kein hartkodierter Fallback.
 */
export function getTesterPassword(): string {
  return (
    readEnvSecret("TESTER_PASSWORD") ||
    readEnvSecret("NEXT_PUBLIC_TESTER_PASSWORD") ||
    getPreviewAccessPassword() ||
    ""
  )
}

export function getLaunchCountdown(now = Date.now()): {
  totalMs: number
  days: number
  hours: number
  minutes: number
  seconds: number
  isPast: boolean
} {
  const totalMs = LAUNCH_DATE.getTime() - now
  const isPast = totalMs <= 0
  const abs = Math.max(0, totalMs)

  return {
    totalMs,
    isPast,
    days: Math.floor(abs / (1000 * 60 * 60 * 24)),
    hours: Math.floor((abs / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((abs / (1000 * 60)) % 60),
    seconds: Math.floor((abs / 1000) % 60),
  }
}
