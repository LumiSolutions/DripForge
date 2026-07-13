import type { JournalLine } from "@/lib/accounting/journal-types"
import { validateJournalEntryLines } from "@/lib/accounting/journal-types"
import {
  computeVatAmount,
  isZeroVatAmountTaxCode,
  resolveTaxRateFromCode,
} from "@/lib/accounting/tax-code-utils"
import { normalizeAccountNumber } from "@/lib/accounting/account-types"
import type { TaxCode } from "@/lib/accounting/tax-code-types"

/** Angehängter Beleg (Bild/PDF) als Base64-Data-URL. */
export type ManualBookingAttachment = {
  name: string
  mimeType: string
  size: number
  dataUrl: string
}

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
  /** Optionaler Beleg-Anhang. */
  attachment?: ManualBookingAttachment | null
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
    attachment: null,
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

function normalizeAttachment(
  value: unknown
): ManualBookingAttachment | null {
  if (!value || typeof value !== "object") return null
  const att = value as Partial<ManualBookingAttachment>
  const name = String(att.name ?? "").trim()
  const mimeType = String(att.mimeType ?? "").trim() || "application/octet-stream"
  const dataUrl = String(att.dataUrl ?? "").trim()
  const size = Number(att.size) || 0
  if (!name) return null
  return { name, mimeType, size, dataUrl }
}

/** Für Cosmos: grosse Base64-Inhalte entfernen (Dokument-Limit ~2 MB). */
export function stripAttachmentPayload(
  row: ManualBookingRow
): ManualBookingRow {
  if (!row.attachment) return { ...row, attachment: null }
  const dataUrl = row.attachment.dataUrl ?? ""
  const keepContent = dataUrl.length > 0 && dataUrl.length <= 180_000
  return {
    ...row,
    attachment: {
      name: row.attachment.name,
      mimeType: row.attachment.mimeType,
      size: row.attachment.size,
      dataUrl: keepContent ? dataUrl : "",
    },
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
    debitAccountNumber: normalizeAccountNumber(row.debitAccountNumber),
    creditAccountNumber: normalizeAccountNumber(row.creditAccountNumber),
    description: String(row.description ?? "").trim(),
    taxCode,
    taxRate,
    taxAmount,
    amount,
    attachment: normalizeAttachment(row.attachment),
  }
}

/** Payload für die Journal-API (Zahlen als number, Datum separat). */
export function toManualBookingApiRows(
  rows: ManualBookingRow[],
  taxCodes: TaxCode[] = []
): ManualBookingRow[] {
  return rows.map((row) => {
    const normalized = normalizeManualBookingRow(row, taxCodes)
    return {
      debitAccountNumber: normalized.debitAccountNumber,
      creditAccountNumber: normalized.creditAccountNumber,
      description: normalized.description,
      taxCode: normalized.taxCode,
      taxRate: Number(normalized.taxRate) || 0,
      taxAmount: Number(normalized.taxAmount) || 0,
      amount: Number(normalized.amount) || 0,
      attachment: normalized.attachment,
    }
  })
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

export function defaultBookingDescription(rows: ManualBookingRow[]): string {
  const texts = rows
    .map((row) => {
      if (row.description.trim()) return row.description.trim()
      if (row.debitAccountNumber && row.creditAccountNumber) {
        return `${row.debitAccountNumber} an ${row.creditAccountNumber}`
      }
      return ""
    })
    .filter(Boolean)
  return texts.join(" · ") || "Manuelle Buchung"
}
