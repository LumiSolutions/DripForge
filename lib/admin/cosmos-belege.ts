import type { SqlQuerySpec } from "@azure/cosmos"
import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  BELEG_DOC_TYPE,
  BELEG_PREFIX,
  belegCosmosId,
  fromBelegCosmosDoc,
  toBelegCosmosDoc,
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
  year: number
  lastSequence: number
  updatedAt: string
}

function counterDocId(type: BelegType, year: number): string {
  return `beleg-counter:${type}:${year}`
}

export async function cosmosAllocateBelegNummer(type: BelegType): Promise<string> {
  const year = new Date().getFullYear()
  const container = await getSettingsContainer()
  const id = counterDocId(type, year)
  const maxAttempts = 10

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      let current: BelegCounterDoc | null = null
      try {
        const { resource } = await container.item(id, id).read<BelegCounterDoc>()
        current = resource ?? null
      } catch (error) {
        if (cosmosErrorCode(error) !== 404) {
          logCosmosError("cosmosAllocateBelegNummer:read", error)
          throw error
        }
      }

      const nextSequenceRaw =
        current?.year === year ? Number(current.lastSequence) + 1 : 1
      const nextSequence =
        Number.isFinite(nextSequenceRaw) && nextSequenceRaw > 0
          ? Math.floor(nextSequenceRaw)
          : 1

      const nextDoc: BelegCounterDoc = {
        id,
        type,
        year,
        lastSequence: nextSequence,
        updatedAt: new Date().toISOString(),
      }
      await container.items.upsert(nextDoc)
      return `${BELEG_PREFIX[type]}-${year}-${String(nextSequence).padStart(4, "0")}`
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

export async function cosmosFindBelegBySourceOrderId(
  orderId: string
): Promise<Beleg | null> {
  const list = await cosmosListBelege({ type: "rechnung", limit: 500 })
  return list.find((b) => b.sourceOrderId === orderId) ?? null
}
