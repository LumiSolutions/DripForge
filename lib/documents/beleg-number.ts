import { BELEG_PREFIX, type BelegType } from "@/lib/documents/beleg-types"
import type { BelegNumberingSettings } from "@/lib/admin/types"

/** Beliebiges A–Z/0–9-Präfix (1–8) — unterstützt Admin-Custom-Präfixe. */
const BELEG_PREFIX_PATTERN = "[A-Z0-9]{1,8}"

const DEFAULT_PREFIX: Record<BelegType, string> = {
  offerte: "OFF",
  rechnung: "INV",
  lieferschein: "LS",
}

function sanitizePrefix(raw: string | undefined | null, fallback: string): string {
  const cleaned = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8)
  if (!cleaned) return fallback
  // Legacy «OF» nie als neues Präfix — immer OFF (einheitliche Offerten)
  if (cleaned === "OF") return "OFF"
  return cleaned
}

/** Löst das Präfix für einen Belegtyp auf (Settings oder Defaults OFF/INV/LS). */
export function resolveBelegPrefix(
  type: BelegType,
  numbering?: BelegNumberingSettings | null
): string {
  if (type === "offerte") {
    return sanitizePrefix(numbering?.offertePrefix, DEFAULT_PREFIX.offerte)
  }
  if (type === "rechnung") {
    return sanitizePrefix(numbering?.rechnungPrefix, DEFAULT_PREFIX.rechnung)
  }
  return sanitizePrefix(numbering?.lieferscheinPrefix, DEFAULT_PREFIX.lieferschein)
}

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
 * Optional: yearFormat:false → PREFIX-#### (ohne Jahr).
 */
export function formatBelegNummer(
  typeOrPrefix: BelegType | string,
  sequence: number,
  year: number = new Date().getFullYear(),
  numbering?: BelegNumberingSettings | null
): string {
  let prefix: string
  if (typeOrPrefix === "offerte" || typeOrPrefix === "rechnung" || typeOrPrefix === "lieferschein") {
    prefix = resolveBelegPrefix(typeOrPrefix, numbering)
  } else if (typeOrPrefix in BELEG_PREFIX) {
    prefix = resolveBelegPrefix(typeOrPrefix as BelegType, numbering)
  } else {
    prefix = sanitizePrefix(String(typeOrPrefix), "OFF")
  }
  const seq = Math.max(1, Math.floor(sequence))
  const useYear = numbering?.yearFormat !== false
  if (useYear) {
    return `${prefix}-${year}-${String(seq).padStart(4, "0")}`
  }
  return `${prefix}-${String(seq).padStart(4, "0")}`
}

/**
 * Anzeigeformat für Admin/PDF/E-Mail. Die gespeicherte Belegnummer ist bereits
 * kanonisch (z. B. INV-2026-0089). Legacy-Nummern (RE-0018) bleiben unverändert,
 * lediglich das Präfix wird gross geschrieben. Legacy «OF-…» wird als «OFF-…» angezeigt.
 */
export function formatBelegDisplayId(id: string): string {
  const trimmed = String(id ?? "").trim()
  if (!trimmed) return trimmed
  if (parseBelegSequence(trimmed) == null) return trimmed

  const prefixMatch = trimmed.match(
    new RegExp(`^(${BELEG_PREFIX_PATTERN})(-|$)`, "i")
  )
  let prefix = prefixMatch?.[1]?.toUpperCase()
  if (!prefix) return trimmed
  // Legacy OF → OFF für Anzeige (einheitliches Offerten-Präfix)
  const rest = trimmed.slice(prefix.length)
  if (prefix === "OF") {
    prefix = "OFF"
  }
  return `${prefix}${rest}`
}

/** Shop-Bestell-ID (df-…) vs. Belegnummer. */
export function isShopOrderId(id: string): boolean {
  const trimmed = String(id ?? "").trim()
  if (!trimmed) return false
  if (trimmed.toLowerCase().startsWith("df-")) return true
  return !isBelegStyleNumber(trimmed)
}
