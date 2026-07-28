import { logCosmosError } from "@/lib/cosmos/log-error"
import type { OrderAnalyticsRow } from "@/lib/admin/analytics-types"
import {
  ORDER_DOC_TYPE,
  resolveOrdersContainer,
  type OrdersStorageMode,
} from "@/lib/cosmos/orders-container"

type CosmosAnalyticsDoc = OrderAnalyticsRow & { id: string; docType?: string }

function analyticsOrdersQuerySql(mode: OrdersStorageMode): string {
  const fields =
    "c.orderId, c.createdAt, c.status, c.totals, c.items, c.billing"
  if (mode === "shared") {
    return `SELECT ${fields} FROM c WHERE c.docType = '${ORDER_DOC_TYPE}'`
  }
  return `SELECT ${fields} FROM c WHERE (NOT IS_DEFINED(c.docType) OR c.docType = '${ORDER_DOC_TYPE}')`
}

/**
 * Schlanke Cosmos-Abfrage: nur Felder für Aggregation (weniger RU/Traffic als SELECT *).
 */
export async function cosmosFetchOrdersForAnalytics(): Promise<OrderAnalyticsRow[]> {
  const { container, mode } = await resolveOrdersContainer()

  try {
    const { resources } = await container.items
      .query<CosmosAnalyticsDoc>(analyticsOrdersQuerySql(mode), { maxItemCount: -1 })
      .fetchAll()

    return resources.map(({ id: _id, docType: _docType, ...row }) => row)
  } catch (error) {
    logCosmosError("cosmosFetchOrdersForAnalytics", error)
    throw error
  }
}
