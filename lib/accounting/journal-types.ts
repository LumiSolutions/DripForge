import type { ManualBookingRow } from "@/lib/accounting/manual-booking"

export type JournalLineType = "SOLL" | "HABEN"

export type JournalLine = {
  accountNumber: string
  type: JournalLineType
  amount: number
  /** MWST-Satz als Dezimalzahl (z. B. 0.081). */
  taxRate: number
  /** Schweizer Steuercode-Kürzel (z. B. UN81, VM81). */
  taxCode?: string
}

export type JournalEntrySource = "manual" | "order" | "beleg"

export type JournalEntry = {
  id: string
  date: string
  belegNummer: string
  description: string
  lines: JournalLine[]
  /** Originalzeilen für manuelle Buchungen (Schweizer Buchungsmaske). */
  bookingRows?: ManualBookingRow[]
  source: JournalEntrySource
  sourceOrderId?: string
  sourceBelegId?: string
  createdAt: string
  updatedAt: string
}

export const JOURNAL_ENTRY_DOC_TYPE = "journal-entry" as const

export type JournalEntryCosmosDoc = JournalEntry & {
  docType: typeof JOURNAL_ENTRY_DOC_TYPE
}

export function journalEntryCosmosId(id: string): string {
  return `${JOURNAL_ENTRY_DOC_TYPE}:${id}`
}

function roundChf(value: number): number {
  return Math.round(value * 100) / 100
}

function toCents(value: number): number {
  return Math.round(roundChf(value) * 100)
}

export function sumJournalSide(
  lines: JournalLine[],
  type: JournalLineType
): number {
  return roundChf(
    lines
      .filter((line) => line.type === type)
      .reduce((sum, line) => sum + (Number(line.amount) || 0), 0)
  )
}

export type JournalValidationResult =
  | { valid: true; sollTotal: number; habenTotal: number }
  | {
      valid: false
      sollTotal: number
      habenTotal: number
      error: string
    }

export function validateJournalEntryLines(
  lines: JournalLine[]
): JournalValidationResult {
  if (!lines.length) {
    return {
      valid: false,
      sollTotal: 0,
      habenTotal: 0,
      error: "Mindestens eine Buchungszeile ist erforderlich.",
    }
  }

  for (const line of lines) {
    if (!line.accountNumber?.trim()) {
      return {
        valid: false,
        sollTotal: 0,
        habenTotal: 0,
        error: "Jede Zeile braucht eine Kontonummer.",
      }
    }
    if (line.type !== "SOLL" && line.type !== "HABEN") {
      return {
        valid: false,
        sollTotal: 0,
        habenTotal: 0,
        error: "Buchungszeilen müssen SOLL oder HABEN sein.",
      }
    }
    if (!Number.isFinite(line.amount) || line.amount <= 0) {
      return {
        valid: false,
        sollTotal: 0,
        habenTotal: 0,
        error: "Beträge müssen grösser als 0 sein.",
      }
    }
    if (!Number.isFinite(line.taxRate) || line.taxRate < 0) {
      return {
        valid: false,
        sollTotal: 0,
        habenTotal: 0,
        error: "MwSt-Satz ist ungültig.",
      }
    }
  }

  const sollTotal = sumJournalSide(lines, "SOLL")
  const habenTotal = sumJournalSide(lines, "HABEN")

  if (toCents(sollTotal) !== toCents(habenTotal)) {
    return {
      valid: false,
      sollTotal,
      habenTotal,
      error: `Soll (${sollTotal.toFixed(2)}) und Haben (${habenTotal.toFixed(2)}) sind nicht ausgeglichen.`,
    }
  }

  return { valid: true, sollTotal, habenTotal }
}

export function normalizeJournalLine(line: Partial<JournalLine>): JournalLine {
  return {
    accountNumber: String(line.accountNumber ?? "").trim(),
    type: line.type === "HABEN" ? "HABEN" : "SOLL",
    amount: roundChf(Number(line.amount) || 0),
    taxRate: roundChf(Number(line.taxRate) || 0),
    taxCode: line.taxCode?.trim() || undefined,
  }
}

export function normalizeJournalEntry(
  input: Partial<JournalEntry> & { id: string }
): JournalEntry {
  const now = new Date().toISOString()
  const rawDate = String(input.date ?? "").trim()
  const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate)
    ? rawDate.slice(0, 10)
    : now.slice(0, 10)

  let bookingRows: ManualBookingRow[] | undefined
  if (Array.isArray(input.bookingRows)) {
    try {
      bookingRows = input.bookingRows.map((row) => {
        try {
          // Lazy import avoided – use inline safe shape so parser never throws
          return {
            debitAccountNumber: String(row?.debitAccountNumber ?? "").trim(),
            creditAccountNumber: String(row?.creditAccountNumber ?? "").trim(),
            description: String(row?.description ?? "").trim(),
            taxCode: String(row?.taxCode ?? "").trim().toUpperCase(),
            taxRate: Number(row?.taxRate) || 0,
            taxAmount: Number(row?.taxAmount) || 0,
            amount: Number(row?.amount) || 0,
            attachment: row?.attachment ?? null,
          } as ManualBookingRow
        } catch {
          return {
            debitAccountNumber: "",
            creditAccountNumber: "",
            description: "",
            taxCode: "",
            taxRate: 0,
            taxAmount: 0,
            amount: 0,
            attachment: null,
          } as ManualBookingRow
        }
      })
    } catch (error) {
      console.error("normalizeJournalEntry: bookingRows fehlerhaft", error)
      bookingRows = undefined
    }
  }

  let lines: JournalLine[] = []
  try {
    lines = (Array.isArray(input.lines) ? input.lines : []).map((line) =>
      normalizeJournalLine(line ?? {})
    )
  } catch (error) {
    console.error("normalizeJournalEntry: lines fehlerhaft", error)
    lines = []
  }

  return {
    id: String(input.id ?? "").trim() || `je-${Date.now()}`,
    date,
    belegNummer: String(
      (input as { belegnummer?: string }).belegnummer ??
        input.belegNummer ??
        ""
    ).trim(),
    description: String(input.description ?? "").trim(),
    lines,
    bookingRows,
    source:
      input.source === "order"
        ? "order"
        : input.source === "beleg"
          ? "beleg"
          : "manual",
    sourceOrderId: input.sourceOrderId?.trim() || undefined,
    sourceBelegId: input.sourceBelegId?.trim() || undefined,
    createdAt: String(input.createdAt ?? now),
    updatedAt: String(input.updatedAt ?? now),
  }
}

export function toJournalEntryCosmosDoc(entry: JournalEntry): JournalEntryCosmosDoc {
  return {
    ...entry,
    id: journalEntryCosmosId(entry.id),
    docType: JOURNAL_ENTRY_DOC_TYPE,
  }
}

export function fromJournalEntryCosmosDoc(doc: JournalEntryCosmosDoc): JournalEntry {
  try {
    const rawId =
      typeof doc.id === "string" && doc.id.startsWith(`${JOURNAL_ENTRY_DOC_TYPE}:`)
        ? doc.id.slice(JOURNAL_ENTRY_DOC_TYPE.length + 1)
        : String(doc.id ?? "")
    return normalizeJournalEntry({ ...doc, id: rawId || `je-${Date.now()}` })
  } catch (error) {
    console.error("fromJournalEntryCosmosDoc: Dokument übersprungen", doc?.id, error)
    const now = new Date().toISOString()
    return {
      id: String(doc?.id ?? `je-${Date.now()}`),
      date: now.slice(0, 10),
      belegNummer: "",
      description: "",
      lines: [],
      source: "manual",
      createdAt: now,
      updatedAt: now,
    }
  }
}
