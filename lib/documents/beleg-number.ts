import { BELEG_PREFIX, type BelegType } from "@/lib/documents/beleg-types"

const BELEG_ID_PREFIXES = ["RE", "OF", "LS", "AN", "LI"] as const

/** Extrahiert die laufende Nummer aus RE-0018 oder Legacy RE-2026-0018. */
export function parseBelegSequence(id: string): number | null {
  const trimmed = String(id ?? "").trim()
  if (!trimmed) return null

  const withYear = trimmed.match(/^(?:RE|OF|LS|AN|LI)-(\d{4})-(\d+)$/i)
  if (withYear) {
    const seq = Number(withYear[2])
    return Number.isFinite(seq) && seq > 0 ? Math.floor(seq) : null
  }

  const short = trimmed.match(/^(?:RE|OF|LS|AN|LI)-(\d+)$/i)
  if (short) {
    const seq = Number(short[1])
    return Number.isFinite(seq) && seq > 0 ? Math.floor(seq) : null
  }

  return null
}

export function isBelegStyleNumber(id: string): boolean {
  return parseBelegSequence(id) != null
}

/** Kurzformat ohne Jahr: RE-0018 */
export function formatBelegNummer(
  typeOrPrefix: BelegType | string,
  sequence: number
): string {
  const prefix =
    typeOrPrefix in BELEG_PREFIX
      ? BELEG_PREFIX[typeOrPrefix as BelegType]
      : String(typeOrPrefix).toUpperCase()
  const seq = Math.max(1, Math.floor(sequence))
  return `${prefix}-${String(seq).padStart(4, "0")}`
}

/**
 * Anzeigeformat für Admin/PDF/E-Mail: Legacy RE-2026-0018 → RE-0018.
 * Unbekannte IDs unverändert zurückgeben.
 */
export function formatBelegDisplayId(id: string): string {
  const trimmed = String(id ?? "").trim()
  if (!trimmed) return trimmed

  const seq = parseBelegSequence(trimmed)
  if (seq == null) return trimmed

  const prefixMatch = trimmed.match(/^(RE|OF|LS|AN|LI)/i)
  const prefix = (prefixMatch?.[1] ?? "RE").toUpperCase()
  if (!(BELEG_ID_PREFIXES as readonly string[]).includes(prefix)) {
    return trimmed
  }
  return formatBelegNummer(prefix, seq)
}

/** Shop-Bestell-ID (df-…) vs. Belegnummer. */
export function isShopOrderId(id: string): boolean {
  const trimmed = String(id ?? "").trim()
  if (!trimmed) return false
  if (trimmed.toLowerCase().startsWith("df-")) return true
  return !isBelegStyleNumber(trimmed)
}
