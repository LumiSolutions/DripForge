import { promises as fs } from "fs"
import path from "path"
import { getSettingsContainer, isCosmosConfigured } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"

/**
 * Kurze, professionelle Referenznummern im Format PREFIX-YYYY-NNNN
 * (z. B. ANF-2026-0042). Jahres-skalierter Zähler mit Cosmos-Counter
 * (ETag) und Datei-Fallback (data/admin/reference-counters.json).
 */

export function formatReferenceNumber(
  prefix: string,
  year: number,
  sequence: number
): string {
  const seq = Math.max(1, Math.floor(sequence))
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`
}

const FILE_COUNTER = path.join(
  process.cwd(),
  "data",
  "admin",
  "reference-counters.json"
)

type CounterFile = Record<string, number>

function counterKey(prefix: string, year: number): string {
  return `${prefix}:${year}`
}

function counterDocId(prefix: string, year: number): string {
  return `refcounter:${prefix}:${year}`
}

function cosmosErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const err = error as { code?: number; statusCode?: number }
  return err.code ?? err.statusCode
}

async function readFileCounters(): Promise<CounterFile> {
  try {
    const raw = await fs.readFile(FILE_COUNTER, "utf-8")
    const parsed = JSON.parse(raw) as CounterFile
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

async function allocateFromFile(prefix: string, year: number): Promise<number> {
  const all = await readFileCounters()
  const key = counterKey(prefix, year)
  const next = (Number(all[key]) || 0) + 1
  all[key] = next
  await fs.mkdir(path.dirname(FILE_COUNTER), { recursive: true })
  await fs.writeFile(FILE_COUNTER, JSON.stringify(all, null, 2), "utf-8")
  return next
}

type RefCounterDoc = {
  id: string
  lastSequence: number
  updatedAt: string
}

async function allocateFromCosmos(prefix: string, year: number): Promise<number> {
  const container = await getSettingsContainer()
  const docId = counterDocId(prefix, year)

  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const { resource, etag } = await container
        .item(docId, docId)
        .read<RefCounterDoc>()

      if (!resource || !etag) {
        throw Object.assign(new Error("missing"), { code: 404 })
      }

      const next = (Number(resource.lastSequence) || 0) + 1
      await container.item(docId, docId).replace(
        { id: docId, lastSequence: next, updatedAt: new Date().toISOString() },
        { accessCondition: { type: "IfMatch", condition: etag } }
      )
      return next
    } catch (error) {
      const code = cosmosErrorCode(error)
      if (code === 404) {
        try {
          await container.items.create({
            id: docId,
            lastSequence: 1,
            updatedAt: new Date().toISOString(),
          })
          return 1
        } catch (createError) {
          if (cosmosErrorCode(createError) === 409) continue
          throw createError
        }
      }
      if (code === 412 || code === 449) continue
      throw error
    }
  }
  throw new Error("Referenznummer konnte nicht atomar vergeben werden.")
}

/** Vergibt die nächste Referenznummer für den Präfix (PREFIX-YYYY-NNNN). */
export async function allocateReferenceNumber(
  prefix: string,
  referenceDate: Date = new Date()
): Promise<string> {
  const year = referenceDate.getFullYear()
  let sequence: number
  if (isCosmosConfigured()) {
    try {
      sequence = await allocateFromCosmos(prefix, year)
    } catch (error) {
      logCosmosError("allocateReferenceNumber", error)
      sequence = await allocateFromFile(prefix, year)
    }
  } else {
    sequence = await allocateFromFile(prefix, year)
  }
  return formatReferenceNumber(prefix, year, sequence)
}
