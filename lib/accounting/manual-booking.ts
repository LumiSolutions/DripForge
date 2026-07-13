import type { JournalLine } from "@/lib/accounting/journal-types"
import { validateJournalEntryLines } from "@/lib/accounting/journal-types"
import {
  computeVatAmount,
  isZeroVatAmountTaxCode,
  resolveTaxRateFromCode,
} from "@/lib/accounting/tax-code-utils"
import type { TaxCode } from "@/lib/accounting/tax-code-types"

export type ManualBookingRow = {
  debitAccountNumber: string
  creditAccountNumber: string
  description: string
  /** Schweizer Steuercode-Kürzel, z. B. UN81, V00. */
  taxCode: string
  /** Abgeleiteter MWST-Satz aus dem Steuercode. */
  taxRate: number
  /** Angezeigter MWST-Betrag (0.00 bei U00/V00). */
  taxAmount: number
  /** Buchungsbetrag in CHF. */
  amount: number
}

function roundChf(value: number): number {
  return Math.round(value * 100) / 100
}

export function emptyManualBookingRow(): ManualBookingRow {
  return {
    debitAccountNumber: "",
    creditAccountNumber: "",
    description: "",
    taxCode: "",
    taxRate: 0,
    taxAmount: 0,
    amount: 0,
  }
}

export function applyTaxCodeToRow(
  row: Partial<ManualBookingRow>,
  taxCode: string,
  taxCodes: TaxCode[]
): ManualBookingRow {
  const normalized = normalizeManualBookingRow(row, taxCodes)
  const rate = resolveTaxRateFromCode(taxCode, taxCodes)
  const taxAmount = isZeroVatAmountTaxCode(taxCode)
    ? 0
    : computeVatAmount(normalized.amount, rate, taxCode)

  return {
    ...normalized,
    taxCode: taxCode.trim().toUpperCase(),
    taxRate: rate,
    taxAmount,
  }
}

export function normalizeManualBookingRow(
  row: Partial<ManualBookingRow> & {
    /** Legacy-Felder aus älteren Buchungen. */
    amountChf?: number
    currency?: string
    exchangeRate?: number
  },
  taxCodes: TaxCode[] = []
): ManualBookingRow {
  const amount = roundChf(
    Number(row.amount) ||
      Number(row.amountChf) ||
      0
  )
  const taxCode = String(row.taxCode ?? "").trim().toUpperCase()
  const taxRate =
    taxCode && taxCodes.length
      ? resolveTaxRateFromCode(taxCode, taxCodes)
      : roundChf(Number(row.taxRate) || 0)
  const taxAmount = isZeroVatAmountTaxCode(taxCode)
    ? 0
    : row.taxAmount != null
      ? roundChf(Number(row.taxAmount))
      : computeVatAmount(amount, taxRate, taxCode)

  return {
    debitAccountNumber: String(row.debitAccountNumber ?? "").trim(),
    creditAccountNumber: String(row.creditAccountNumber ?? "").trim(),
    description: String(row.description ?? "").trim(),
    taxCode,
    taxRate,
    taxAmount,
    amount,
  }
}

export function manualRowsToJournalLines(rows: ManualBookingRow[]): JournalLine[] {
  const lines: JournalLine[] = []
  for (const row of rows) {
    const lineBase = {
      amount: row.amount,
      taxRate: row.taxRate,
      taxCode: row.taxCode || undefined,
    }
    lines.push({
      accountNumber: row.debitAccountNumber,
      type: "SOLL",
      ...lineBase,
    })
    lines.push({
      accountNumber: row.creditAccountNumber,
      type: "HABEN",
      ...lineBase,
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
    if (!Number.isFinite(row.amount) || row.amount <= 0) {
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
