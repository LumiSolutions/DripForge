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

      const nextSequence =
        current?.year === year ? current.lastSequence + 1 : 1
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
  const querySpec: SqlQuerySpec = {
    query:
      "SELECT * FROM c WHERE c.docType = @docType ORDER BY c.date DESC, c.createdAt DESC OFFSET 0 LIMIT @limit",
    parameters: [
      { name: "@docType", value: JOURNAL_ENTRY_DOC_TYPE },
      { name: "@limit", value: limit },
    ],
  }
  const { resources } = await container.items
    .query<JournalEntryCosmosDoc>(querySpec)
    .fetchAll()

  let entries = resources.map(fromJournalEntryCosmosDoc)
  if (options?.from) {
    entries = entries.filter((entry) => entry.date >= options.from!)
  }
  if (options?.to) {
    entries = entries.filter((entry) => entry.date <= options.to!)
  }
  if (options?.source) {
    entries = entries.filter((entry) => entry.source === options.source)
  }
  return entries
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
