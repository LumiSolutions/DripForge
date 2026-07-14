import type { SqlQuerySpec } from "@azure/cosmos"
import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  JOURNAL_ENTRY_DOC_TYPE,
  fromJournalEntryCosmosDoc,
  journalEntryCosmosId,
  normalizeJournalEntry,
  toJournalEntryCosmosDoc,
  validateJournalEntryLines,
  type JournalEntry,
  type JournalEntryCosmosDoc,
} from "@/lib/accounting/journal-types"

function cosmosErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const err = error as { code?: number; statusCode?: number }
  return err.code ?? err.statusCode
}

type JournalCounterDoc = {
  id: string
  year: number
  lastSequence: number
  updatedAt: string
}

const JOURNAL_COUNTER_DOC_ID = "journal-counter"

export async function cosmosAllocateJournalBelegNummer(
  dateIso: string
): Promise<string> {
  const year = Number(dateIso.slice(0, 4)) || new Date().getFullYear()
  const container = await getSettingsContainer()
  const maxAttempts = 10

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      let current: JournalCounterDoc | null = null
      try {
        const { resource } = await container
          .item(JOURNAL_COUNTER_DOC_ID, JOURNAL_COUNTER_DOC_ID)
          .read<JournalCounterDoc>()
        current = resource ?? null
      } catch (error) {
        if (cosmosErrorCode(error) !== 404) {
          logCosmosError("cosmosAllocateJournalBelegNummer:read", error)
          throw error
        }
      }

      const nextSequenceRaw =
        current?.year === year ? Number(current.lastSequence) + 1 : 1
      const nextSequence =
        Number.isFinite(nextSequenceRaw) && nextSequenceRaw > 0
          ? Math.floor(nextSequenceRaw)
          : 1
      const nextDoc: JournalCounterDoc = {
        id: JOURNAL_COUNTER_DOC_ID,
        year,
        lastSequence: nextSequence,
        updatedAt: new Date().toISOString(),
      }

      await container.items.upsert(nextDoc)
      return `${year}-${String(nextSequence).padStart(4, "0")}`
    } catch (error) {
      const code = cosmosErrorCode(error)
      if (code === 409 || code === 412 || code === 449) continue
      logCosmosError("cosmosAllocateJournalBelegNummer", error)
      throw error
    }
  }

  throw new Error("Belegnummer konnte nicht vergeben werden.")
}

export async function cosmosGetJournalEntries(options?: {
  limit?: number
  from?: string
  to?: string
  source?: JournalEntry["source"]
}): Promise<JournalEntry[]> {
  const limit = Math.min(500, Math.max(1, options?.limit ?? 200))
  const container = await getSettingsContainer()

  // Einfache Query ohne ORDER BY / Source-Filter:
  // Composite-Index-Anforderungen von Cosmos verursachen sonst leicht 400/500.
  const querySpec: SqlQuerySpec = {
    query: "SELECT * FROM c WHERE c.docType = @docType",
    parameters: [{ name: "@docType", value: JOURNAL_ENTRY_DOC_TYPE }],
  }

  let resources: JournalEntryCosmosDoc[] = []
  try {
    const result = await container.items
      .query<JournalEntryCosmosDoc>(querySpec)
      .fetchAll()
    resources = result.resources ?? []
  } catch (error) {
    logCosmosError("cosmosGetJournalEntries:query", error)
    throw error
  }

  const entries: JournalEntry[] = []
  for (const doc of resources) {
    try {
      if (!doc || doc.docType !== JOURNAL_ENTRY_DOC_TYPE) continue
      const entry = fromJournalEntryCosmosDoc(doc)
      entries.push(entry)
    } catch (error) {
      console.error(
        "cosmosGetJournalEntries: Dokument konnte nicht geparst werden.",
        doc?.id,
        error
      )
    }
  }

  let filtered = entries
  if (options?.source) {
    filtered = filtered.filter((entry) => entry.source === options.source)
  }
  if (options?.from) {
    filtered = filtered.filter((entry) => entry.date >= options.from!)
  }
  if (options?.to) {
    filtered = filtered.filter((entry) => entry.date <= options.to!)
  }

  filtered.sort((a, b) => {
    const dateCmp = String(b.date ?? "").localeCompare(String(a.date ?? ""))
    if (dateCmp !== 0) return dateCmp
    return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
  })

  return filtered.slice(0, limit)
}

export async function cosmosGetJournalEntryById(
  id: string
): Promise<JournalEntry | null> {
  const cosmosId = journalEntryCosmosId(id)
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(cosmosId, cosmosId)
      .read<JournalEntryCosmosDoc>()
    if (!resource || resource.docType !== JOURNAL_ENTRY_DOC_TYPE) return null
    return fromJournalEntryCosmosDoc(resource)
  } catch (error) {
    if (cosmosErrorCode(error) === 404) return null
    logCosmosError(`cosmosGetJournalEntryById:${id}`, error)
    throw error
  }
}

export async function cosmosGetJournalEntryBySourceOrderId(
  orderId: string
): Promise<JournalEntry | null> {
  const trimmed = orderId.trim()
  if (!trimmed) return null

  const container = await getSettingsContainer()
  const querySpec: SqlQuerySpec = {
    query: "SELECT * FROM c WHERE c.docType = @docType AND c.sourceOrderId = @orderId",
    parameters: [
      { name: "@docType", value: JOURNAL_ENTRY_DOC_TYPE },
      { name: "@orderId", value: trimmed },
    ],
  }
  const { resources } = await container.items
    .query<JournalEntryCosmosDoc>(querySpec)
    .fetchAll()

  const doc = resources[0]
  return doc ? fromJournalEntryCosmosDoc(doc) : null
}

export async function cosmosUpsertJournalEntry(entry: JournalEntry): Promise<JournalEntry> {
  const validation = validateJournalEntryLines(entry.lines)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const normalized = normalizeJournalEntry(entry)
  const container = await getSettingsContainer()
  await container.items.upsert(toJournalEntryCosmosDoc(normalized))
  return normalized
}

export async function cosmosCreateJournalEntry(
  input: Omit<JournalEntry, "id" | "createdAt" | "updatedAt" | "belegNummer"> & {
    id?: string
    belegNummer?: string
    bookingRows?: JournalEntry["bookingRows"]
  }
): Promise<JournalEntry> {
  const now = new Date().toISOString()
  const id = input.id?.trim() || `je-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const belegNummer =
    input.belegNummer?.trim() ||
    (await cosmosAllocateJournalBelegNummer(input.date || now))

  return cosmosUpsertJournalEntry({
    ...input,
    id,
    belegNummer,
    bookingRows: input.bookingRows,
    createdAt: now,
    updatedAt: now,
  })
}

export async function cosmosUpdateJournalEntry(
  id: string,
  input: {
    date: string
    belegNummer?: string
    description: string
    lines: JournalEntry["lines"]
    bookingRows?: JournalEntry["bookingRows"]
  }
): Promise<JournalEntry> {
  const existing = await cosmosGetJournalEntryById(id)
  if (!existing) {
    throw new Error("Buchung nicht gefunden.")
  }

  const now = new Date().toISOString()
  return cosmosUpsertJournalEntry({
    ...existing,
    date: input.date,
    belegNummer: input.belegNummer?.trim() || existing.belegNummer || "",
    description: input.description,
    lines: input.lines,
    bookingRows: input.bookingRows,
    // source / sourceOrderId bleiben erhalten – nur manuelle Felder ändern
    updatedAt: now,
    createdAt: existing.createdAt,
    id: existing.id,
  })
}

/**
 * Löscht eine Journalbuchung. Kontosalden in Berichten werden aus dem Journal
 * berechnet — nach dem Löschen stimmen Bilanz/ER/Kontenblatt automatisch wieder.
 */
export async function cosmosDeleteJournalEntry(id: string): Promise<void> {
  const trimmed = id.trim()
  if (!trimmed) {
    throw new Error("Buchungs-ID fehlt.")
  }

  const existing = await cosmosGetJournalEntryById(trimmed)
  if (!existing) {
    throw new Error("Buchung nicht gefunden.")
  }

  const cosmosId = journalEntryCosmosId(trimmed)
  const container = await getSettingsContainer()
  try {
    await container.item(cosmosId, cosmosId).delete()
  } catch (error) {
    if (cosmosErrorCode(error) === 404) {
      throw new Error("Buchung nicht gefunden.")
    }
    logCosmosError(`cosmosDeleteJournalEntry:${trimmed}`, error)
    throw error
  }
}
