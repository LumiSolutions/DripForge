export type JournalLineType = "SOLL" | "HABEN"

export type JournalLine = {
  accountNumber: string
  type: JournalLineType
  amount: number
  taxRate: number
}

export type JournalEntrySource = "manual" | "order"

export type JournalEntry = {
  id: string
  date: string
  belegNummer: string
  description: string
  lines: JournalLine[]
  source: JournalEntrySource
  sourceOrderId?: string
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
  }
}

export function normalizeJournalEntry(
  input: Partial<JournalEntry> & { id: string }
): JournalEntry {
  const now = new Date().toISOString()
  return {
    id: input.id,
    date: String(input.date ?? "").slice(0, 10),
    belegNummer: String(input.belegNummer ?? "").trim(),
    description: String(input.description ?? "").trim(),
    lines: (input.lines ?? []).map(normalizeJournalLine),
    source: input.source === "order" ? "order" : "manual",
    sourceOrderId: input.sourceOrderId?.trim() || undefined,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
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
  const rawId = doc.id.startsWith(`${JOURNAL_ENTRY_DOC_TYPE}:`)
    ? doc.id.slice(JOURNAL_ENTRY_DOC_TYPE.length + 1)
    : doc.id
  return normalizeJournalEntry({ ...doc, id: rawId })
}
