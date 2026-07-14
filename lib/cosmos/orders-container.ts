import type { Container } from "@azure/cosmos"
import { ensureDatabase, getSettingsContainer } from "@/lib/cosmos/client"

export const ORDER_DOC_TYPE = "order"

export type OrdersStorageMode = "dedicated" | "shared"

type State = {
  container: Container
  mode: OrdersStorageMode
}

let resolved: State | null = null

/**
 * Bestellungen: dedizierter Container wenn vorhanden, sonst settings (docType=order).
 */
export async function resolveOrdersContainer(): Promise<State> {
  if (resolved) return resolved

  const database = await ensureDatabase()

  try {
    const dedicated = database.container("orders")
    await dedicated.read()
    resolved = { container: dedicated, mode: "dedicated" }
    console.info("Cosmos DB: Container 'orders' aktiv.")
    return resolved
  } catch {
    const shared = await getSettingsContainer()
    resolved = { container: shared, mode: "shared" }
    console.warn(
      "Cosmos DB: Container 'orders' nicht verfügbar — Bestellungen werden im Container 'settings' (docType=order) gespeichert."
    )
    return resolved
  }
}

export function ordersQuerySql(mode: OrdersStorageMode): string {
  if (mode === "shared") {
    return `SELECT * FROM c WHERE c.docType = '${ORDER_DOC_TYPE}'`
  }
  return `SELECT * FROM c WHERE (NOT IS_DEFINED(c.docType) OR c.docType = '${ORDER_DOC_TYPE}')`
}

export function toOrderCosmosDoc<T extends { id: string }>(
  order: T,
  mode: OrdersStorageMode
): T & { docType?: string } {
  if (mode === "shared") {
    return { ...order, docType: ORDER_DOC_TYPE }
  }
  return order
}

export function resetOrdersContainerCache(): void {
  resolved = null
}
