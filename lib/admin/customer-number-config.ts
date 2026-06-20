/** Krumme Startbasis pro Kalenderjahr (erster Kunde erhält Basis + 1). */
export const CUSTOMER_NUMBER_YEAR_BASE: Readonly<Record<number, number>> = {
  2026: 53718,
  2027: 61481,
}

const FALLBACK_BASE_OFFSET = 48291

export function getCustomerNumberYearPrefix(referenceDate = new Date()): string {
  return String(referenceDate.getFullYear()).slice(-2)
}

export function getYearBaseSequence(
  year: number,
  configured: Readonly<Record<number, number>> = CUSTOMER_NUMBER_YEAR_BASE
): number {
  if (configured[year] !== undefined) return configured[year]
  return FALLBACK_BASE_OFFSET + (year % 100) * 137
}

export function formatCustomerNumber(
  yearPrefix: string,
  sequence: number
): string {
  return `${yearPrefix}-${sequence}`
}

export function parseSequenceFromCustomerNumber(
  kundennummer: string,
  yearPrefix: string
): number | null {
  const expectedPrefix = `${yearPrefix}-`
  if (!kundennummer.startsWith(expectedPrefix)) return null

  const suffix = kundennummer.slice(expectedPrefix.length)
  if (!/^\d+$/.test(suffix)) return null

  const parsed = Number.parseInt(suffix, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function findMaxSequenceInPool(
  existing: Array<{ kundennummer: string }>,
  yearPrefix: string
): number | null {
  let max: number | null = null

  for (const entry of existing) {
    const sequence = parseSequenceFromCustomerNumber(
      entry.kundennummer,
      yearPrefix
    )
    if (sequence === null) continue
    max = max === null ? sequence : Math.max(max, sequence)
  }

  return max
}
