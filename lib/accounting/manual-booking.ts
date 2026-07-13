import type { JournalLine } from "@/lib/accounting/journal-types"
import { validateJournalEntryLines } from "@/lib/accounting/journal-types"

export type ManualBookingRow = {
  debitAccountNumber: string
  creditAccountNumber: string
  description: string
  taxRate: number
  amount: number
  currency: string
  exchangeRate: number
  amountChf: number
}

function roundChf(value: number): number {
  return Math.round(value * 100) / 100
}

export function emptyManualBookingRow(): ManualBookingRow {
  return {
    debitAccountNumber: "",
    creditAccountNumber: "",
    description: "",
    taxRate: 0,
    amount: 0,
    currency: "CHF",
    exchangeRate: 1,
    amountChf: 0,
  }
}

export function normalizeManualBookingRow(
  row: Partial<ManualBookingRow>
): ManualBookingRow {
  const amount = roundChf(Number(row.amount) || 0)
  const exchangeRate = roundChf(Number(row.exchangeRate) || 1) || 1
  const amountChf = roundChf(
    row.amountChf != null && row.amountChf > 0
      ? Number(row.amountChf)
      : amount * exchangeRate
  )

  return {
    debitAccountNumber: String(row.debitAccountNumber ?? "").trim(),
    creditAccountNumber: String(row.creditAccountNumber ?? "").trim(),
    description: String(row.description ?? "").trim(),
    taxRate: roundChf(Number(row.taxRate) || 0),
    amount,
    currency: String(row.currency ?? "CHF").trim() || "CHF",
    exchangeRate,
    amountChf,
  }
}

export function manualRowsToJournalLines(rows: ManualBookingRow[]): JournalLine[] {
  const lines: JournalLine[] = []
  for (const row of rows) {
    const amount = row.amountChf > 0 ? row.amountChf : row.amount
    lines.push({
      accountNumber: row.debitAccountNumber,
      type: "SOLL",
      amount,
      taxRate: row.taxRate,
    })
    lines.push({
      accountNumber: row.creditAccountNumber,
      type: "HABEN",
      amount,
      taxRate: row.taxRate,
    })
  }
  return lines
}

export function validateManualBookingRows(rows: ManualBookingRow[]): {
  valid: boolean
  error?: string
} {
  if (!rows.length) {
    return { valid: false, error: "Mindestens eine Buchungszeile ist erforderlich." }
  }

  for (const [index, row] of rows.entries()) {
    if (!row.debitAccountNumber || !row.creditAccountNumber) {
      return {
        valid: false,
        error: `Zeile ${index + 1}: Soll- und Haben-Konto sind Pflicht.`,
      }
    }
    if (row.debitAccountNumber === row.creditAccountNumber) {
      return {
        valid: false,
        error: `Zeile ${index + 1}: Soll- und Haben-Konto dürfen nicht identisch sein.`,
      }
    }
    const amount = row.amountChf > 0 ? row.amountChf : row.amount
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        valid: false,
        error: `Zeile ${index + 1}: Betrag muss grösser als 0 sein.`,
      }
    }
  }

  const lines = manualRowsToJournalLines(rows)
  const balance = validateJournalEntryLines(lines)
  if (!balance.valid) {
    return { valid: false, error: balance.error }
  }

  return { valid: true }
}
