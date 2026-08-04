import type { SqlQuerySpec } from "@azure/cosmos"
import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  formatBelegNummer,
  parseBelegSequence,
} from "@/lib/documents/beleg-number"
import {
  BELEG_DOC_TYPE,
  fromBelegCosmosDoc,
  toBelegCosmosDoc,
  belegCosmosId,
  type Beleg,
  type BelegCosmosDoc,
  type BelegType,
} from "@/lib/documents/beleg-types"

function cosmosErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const err = error as { code?: number; statusCode?: number }
  return err.code ?? err.statusCode
}

type BelegCounterDoc = {
  id: string
  type: BelegType
  /** @deprecated Jahr nur noch für Legacy-Counter-Docs */
  year?: number
  lastSequence: number
  updatedAt: string
}

/** Globaler Counter (Sequenz); das Jahr wird beim Formatieren gesetzt → INV-2026-0089 */
function counterDocId(type: BelegType): string {
  return `beleg-counter:${type}`
}

function legacyCounterDocId(type: BelegType, year: number): string {
  return `beleg-counter:${type}:${year}`
}

async function readCounterDoc(
  container: Awaited<ReturnType<typeof getSettingsContainer>>,
  id: string
): Promise<BelegCounterDoc | null> {
  try {
    const { resource } = await container.item(id, id).read<BelegCounterDoc>()
    return resource ?? null
  } catch (error) {
    if (cosmosErrorCode(error) === 404) return null
    throw error
  }
}

/** Seed aus Legacy-Jahres-Countern und bestehenden Beleg-IDs. */
async function resolveSeedSequence(
  container: Awaited<ReturnType<typeof getSettingsContainer>>,
  type: BelegType
): Promise<number> {
  let seed = 0
  const year = new Date().getFullYear()
  for (const y of [year, year - 1, year - 2]) {
    try {
      const legacy = await readCounterDoc(container, legacyCounterDocId(type, y))
      if (legacy?.lastSequence != null) {
        const n = Number(legacy.lastSequence)
        if (Number.isFinite(n) && n > seed) seed = Math.floor(n)
      }
    } catch (error) {
      logCosmosError("cosmosAllocateBelegNummer:legacySeed", error)
    }
  }

  try {
    const existing = await cosmosListBelege({ type, limit: 500 })
    for (const beleg of existing) {
      const seq = parseBelegSequence(beleg.id)
      if (seq != null && seq > seed) seed = seq
    }
  } catch (error) {
    logCosmosError("cosmosAllocateBelegNummer:listSeed", error)
  }

  return seed
}

export async function cosmosAllocateBelegNummer(type: BelegType): Promise<string> {
  const container = await getSettingsContainer()
  const id = counterDocId(type)
  const maxAttempts = 10

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      let current = await readCounterDoc(container, id)
      if (!current) {
        const seed = await resolveSeedSequence(container, type)
        current = {
          id,
          type,
          lastSequence: seed,
          updatedAt: new Date().toISOString(),
        }
      }

      const nextSequenceRaw = Number(current.lastSequence) + 1
      const nextSequence =
        Number.isFinite(nextSequenceRaw) && nextSequenceRaw > 0
          ? Math.floor(nextSequenceRaw)
          : 1

      const nextDoc: BelegCounterDoc = {
        id,
        type,
        lastSequence: nextSequence,
        updatedAt: new Date().toISOString(),
      }
      await container.items.upsert(nextDoc)
      return formatBelegNummer(type, nextSequence)
    } catch (error) {
      const code = cosmosErrorCode(error)
      if (code === 409 || code === 412 || code === 449) continue
      logCosmosError("cosmosAllocateBelegNummer", error)
      throw error
    }
  }

  throw new Error("Belegnummer konnte nicht vergeben werden.")
}

export async function cosmosListBelege(options?: {
  type?: BelegType
  limit?: number
}): Promise<Beleg[]> {
  const limit = Math.min(500, Math.max(1, options?.limit ?? 300))
  const container = await getSettingsContainer()
  const querySpec: SqlQuerySpec = {
    query: "SELECT * FROM c WHERE c.docType = @docType",
    parameters: [{ name: "@docType", value: BELEG_DOC_TYPE }],
  }

  try {
    const { resources } = await container.items
      .query<BelegCosmosDoc>(querySpec)
      .fetchAll()
    let list = (resources ?? []).map((doc) => fromBelegCosmosDoc(doc))
    if (options?.type) {
      list = list.filter((b) => b.type === options.type)
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return list.slice(0, limit)
  } catch (error) {
    logCosmosError("cosmosListBelege", error)
    return []
  }
}

export async function cosmosGetBelegById(id: string): Promise<Beleg | null> {
  const container = await getSettingsContainer()
  const cosmosId = belegCosmosId(id)
  try {
    const { resource } = await container
      .item(cosmosId, cosmosId)
      .read<BelegCosmosDoc>()
    return resource ? fromBelegCosmosDoc(resource) : null
  } catch (error) {
    if (cosmosErrorCode(error) === 404) return null
    logCosmosError("cosmosGetBelegById", error)
    throw error
  }
}

export async function cosmosUpsertBeleg(beleg: Beleg): Promise<Beleg> {
  const container = await getSettingsContainer()
  const withStamp: Beleg = {
    ...beleg,
    updatedAt: new Date().toISOString(),
  }
  const doc = toBelegCosmosDoc(withStamp)
  await container.items.upsert(doc)
  return fromBelegCosmosDoc(doc)
}

export async function cosmosDeleteBeleg(id: string): Promise<boolean> {
  const container = await getSettingsContainer()
  const cosmosId = belegCosmosId(id)
  try {
    await container.item(cosmosId, cosmosId).delete()
    return true
  } catch (error) {
    if (cosmosErrorCode(error) === 404) return false
    logCosmosError("cosmosDeleteBeleg", error)
    throw error
  }
}

export async function cosmosFindBelegeBySourceOrderId(
  orderId: string
): Promise<Beleg[]> {
  const trimmed = orderId.trim()
  if (!trimmed) return []
  const list = await cosmosListBelege({ limit: 500 })
  return list.filter((b) => b.sourceOrderId === trimmed)
}

export async function cosmosFindBelegBySourceOrderId(
  orderId: string
): Promise<Beleg | null> {
  const list = await cosmosFindBelegeBySourceOrderId(orderId)
  return list.find((b) => b.type === "rechnung") ?? list[0] ?? null
}
