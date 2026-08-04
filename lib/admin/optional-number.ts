/**
 * Helpers for admin numeric inputs that must allow a fully empty field
 * (so users can clear a value and type a new one without a sticky leading 0).
 */

export function formatOptionalNumber(
  value: number | null | undefined
): string {
  if (value == null) return ""
  if (!Number.isFinite(Number(value))) return ""
  return String(value)
}

/** Parse input text → number or null when empty/invalid. */
export function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/** Like parseOptionalNumber but keeps integers (for qty / minutes). */
export function parseOptionalInt(raw: string): number | null {
  const n = parseOptionalNumber(raw)
  if (n == null) return null
  return Math.round(n)
}
