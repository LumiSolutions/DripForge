/** Kurze, lesbare Bestell-IDs im Format DF-10042. */

export const ORDER_ID_PREFIX = "DF"
/** Erste vergebene laufende Nummer (DF-10001). */
export const ORDER_ID_SEQUENCE_START = 10000

export function formatOrderId(sequence: number): string {
  const seq = Math.max(1, Math.floor(sequence))
  return `${ORDER_ID_PREFIX}-${seq}`
}

/** Extrahiert die Sequenz aus DF-10042 / DF-2026-8912 / Legacy df-…. */
export function parseOrderSequence(id: string): number | null {
  const trimmed = String(id ?? "").trim()
  if (!trimmed) return null

  const withYear = trimmed.match(/^DF-(\d{4})-(\d+)$/i)
  if (withYear) {
    const seq = Number(withYear[2])
    return Number.isFinite(seq) && seq > 0 ? Math.floor(seq) : null
  }

  const short = trimmed.match(/^DF-(\d+)$/i)
  if (short) {
    const seq = Number(short[1])
    return Number.isFinite(seq) && seq > 0 ? Math.floor(seq) : null
  }

  return null
}

export function isFriendlyOrderId(id: string): boolean {
  return parseOrderSequence(id) != null
}

/** Fallback ohne Counter (nur Notfall) — weiterhin lesbar. */
export function createFallbackOrderId(): string {
  const year = new Date().getFullYear()
  const tail = String(Date.now()).slice(-4)
  return `${ORDER_ID_PREFIX}-${year}-${tail}`
}
