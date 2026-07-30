import { promises as fs } from "fs"
import path from "path"
import { getSettingsContainer, isCosmosConfigured } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  ORDER_ID_PREFIX,
  ORDER_ID_SEQUENCE_START,
  formatOrderId,
  parseOrderSequence,
} from "@/lib/admin/order-id"

type OrderCounterDoc = {
  id: string
  lastSequence: number
  updatedAt: string
}

const COUNTER_DOC_ID = "order-counter"
const FILE_COUNTER = path.join(process.cwd(), "data", "admin", "order-counter.json")

function cosmosErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const err = error as { code?: number; statusCode?: number }
  return err.code ?? err.statusCode
}

async function readFileCounter(): Promise<number> {
  try {
    const raw = await fs.readFile(FILE_COUNTER, "utf-8")
    const parsed = JSON.parse(raw) as { lastSequence?: number }
    const n = Number(parsed.lastSequence)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : ORDER_ID_SEQUENCE_START
  } catch {
    return ORDER_ID_SEQUENCE_START
  }
}

async function writeFileCounter(sequence: number): Promise<void> {
  await fs.mkdir(path.dirname(FILE_COUNTER), { recursive: true })
  await fs.writeFile(
    FILE_COUNTER,
    JSON.stringify(
      {
        id: COUNTER_DOC_ID,
        lastSequence: sequence,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  )
}

async function allocateFromFile(seedMax?: number | null): Promise<string> {
  const current = await readFileCounter()
  const baseline = Math.max(current, seedMax ?? 0, ORDER_ID_SEQUENCE_START)
  const next = baseline + 1
  await writeFileCounter(next)
  return formatOrderId(next)
}

async function discoverMaxOrderSequence(): Promise<number> {
  try {
    const { getOrders } = await import("@/lib/admin/db")
    const orders = await getOrders()
    let max = ORDER_ID_SEQUENCE_START
    for (const order of orders) {
      const seq = parseOrderSequence(order.orderId)
      if (seq != null && seq > max) max = seq
    }
    return max
  } catch (error) {
    logCosmosError("discoverMaxOrderSequence", error)
    return ORDER_ID_SEQUENCE_START
  }
}

async function allocateFromCosmos(seedMax: number): Promise<string> {
  const container = await getSettingsContainer()
  const maxAttempts = 12

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { resource, etag } = await container
        .item(COUNTER_DOC_ID, COUNTER_DOC_ID)
        .read<OrderCounterDoc>()

      if (!resource || !etag) {
        throw Object.assign(new Error("missing"), { code: 404 })
      }

      const baseline = Math.max(
        Number(resource.lastSequence) || 0,
        seedMax,
        ORDER_ID_SEQUENCE_START
      )
      const nextSequence = baseline + 1
      const nextDoc: OrderCounterDoc = {
        id: COUNTER_DOC_ID,
        lastSequence: nextSequence,
        updatedAt: new Date().toISOString(),
      }

      await container.item(COUNTER_DOC_ID, COUNTER_DOC_ID).replace(nextDoc, {
        accessCondition: { type: "IfMatch", condition: etag },
      })

      return formatOrderId(nextSequence)
    } catch (error) {
      const code = cosmosErrorCode(error)

      if (code === 404) {
        const nextSequence = Math.max(seedMax, ORDER_ID_SEQUENCE_START) + 1
        const doc: OrderCounterDoc = {
          id: COUNTER_DOC_ID,
          lastSequence: nextSequence,
          updatedAt: new Date().toISOString(),
        }
        try {
          await container.items.create(doc)
          return formatOrderId(nextSequence)
        } catch (createError) {
          const createCode = cosmosErrorCode(createError)
          if (createCode === 409) continue
          logCosmosError("cosmosAllocateOrderId:create", createError)
          throw createError
        }
      }

      if (code === 412 || code === 449) continue

      logCosmosError("cosmosAllocateOrderId", error)
      throw error
    }
  }

  throw new Error("Bestell-ID konnte nicht atomar vergeben werden.")
}

/** Vergibt die nächste Bestell-ID (DF-10001, DF-10002, …). */
export async function allocateOrderId(): Promise<string> {
  const seedMax = await discoverMaxOrderSequence()

  if (isCosmosConfigured()) {
    try {
      return await allocateFromCosmos(seedMax)
    } catch (error) {
      console.warn(
        "Bestell-ID: Cosmos-Counter fehlgeschlagen — Datei-Fallback.",
        error
      )
      return allocateFromFile(seedMax)
    }
  }

  return allocateFromFile(seedMax)
}

export function canUseCosmosOrderCounter(): boolean {
  return isCosmosConfigured()
}

export { ORDER_ID_PREFIX, formatOrderId }
