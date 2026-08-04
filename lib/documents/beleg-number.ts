import { BELEG_PREFIX, type BelegType } from "@/lib/documents/beleg-types"

// Aktuelle + Legacy-Präfixe (INV/OFF neu, RE/OF/AN/LI alt) für Parsing/Anzeige.
const BELEG_ID_PREFIXES = [
  "INV",
  "OFF",
  "RE",
  "OF",
  "LS",
  "AN",
  "LI",
] as const

const BELEG_PREFIX_PATTERN = "INV|OFF|RE|OF|LS|AN|LI"

/** Extrahiert die laufende Nummer aus INV-2026-0089, RE-0018 oder RE-2026-0018. */
export function parseBelegSequence(id: string): number | null {
  const trimmed = String(id ?? "").trim()
  if (!trimmed) return null

  const withYear = trimmed.match(
    new RegExp(`^(?:${BELEG_PREFIX_PATTERN})-(\\d{4})-(\\d+)$`, "i")
  )
  if (withYear) {
    const seq = Number(withYear[2])
    return Number.isFinite(seq) && seq > 0 ? Math.floor(seq) : null
  }

  const short = trimmed.match(
    new RegExp(`^(?:${BELEG_PREFIX_PATTERN})-(\\d+)$`, "i")
  )
  if (short) {
    const seq = Number(short[1])
    return Number.isFinite(seq) && seq > 0 ? Math.floor(seq) : null
  }

  return null
}

export function isBelegStyleNumber(id: string): boolean {
  return parseBelegSequence(id) != null
}

/**
 * Neues Format inkl. Jahr: INV-2026-0089 / OFF-2026-0105.
 * Das Jahr wird bei der Vergabe fest in die gespeicherte Nummer geschrieben.
 */
export function formatBelegNummer(
  typeOrPrefix: BelegType | string,
  sequence: number,
  year: number = new Date().getFullYear()
): string {
  const prefix =
    typeOrPrefix in BELEG_PREFIX
      ? BELEG_PREFIX[typeOrPrefix as BelegType]
      : String(typeOrPrefix).toUpperCase()
  const seq = Math.max(1, Math.floor(sequence))
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`
}

/**
 * Anzeigeformat für Admin/PDF/E-Mail. Die gespeicherte Belegnummer ist bereits
 * kanonisch (z. B. INV-2026-0089). Legacy-Nummern (RE-0018) bleiben unverändert,
 * lediglich das Präfix wird gross geschrieben.
 */
export function formatBelegDisplayId(id: string): string {
  const trimmed = String(id ?? "").trim()
  if (!trimmed) return trimmed
  if (parseBelegSequence(trimmed) == null) return trimmed

  const prefixMatch = trimmed.match(
    new RegExp(`^(${BELEG_PREFIX_PATTERN})`, "i")
  )
  const prefix = prefixMatch?.[1]?.toUpperCase()
  if (!prefix || !(BELEG_ID_PREFIXES as readonly string[]).includes(prefix)) {
    return trimmed
  }
  // Präfix normalisieren (Grossschreibung), Rest der Nummer beibehalten.
  return `${prefix}${trimmed.slice(prefix.length)}`
}

/** Shop-Bestell-ID (df-…) vs. Belegnummer. */
export function isShopOrderId(id: string): boolean {
  const trimmed = String(id ?? "").trim()
  if (!trimmed) return false
  if (trimmed.toLowerCase().startsWith("df-")) return true
  return !isBelegStyleNumber(trimmed)
}
