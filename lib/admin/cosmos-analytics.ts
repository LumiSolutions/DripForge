import { getOrdersContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import type { OrderAnalyticsRow } from "@/lib/admin/analytics-types"

type CosmosAnalyticsDoc = OrderAnalyticsRow & { id: string }

/**
 * Schlanke Cosmos-Abfrage: nur Felder fuer Aggregation (weniger RU/Traffic als SELECT *).
 */
export async function cosmosFetchOrdersForAnalytics(): Promise<OrderAnalyticsRow[]> {
  const container = await getOrdersContainer()
  const query =
    "SELECT c.orderId, c.createdAt, c.status, c.totals, c.items, c.billing FROM c"

  try {
    const { resources } = await container.items
      .query<CosmosAnalyticsDoc>(query, { maxItemCount: -1 })
      .fetchAll()

    return resources.map(({ id: _id, ...row }) => row)
  } catch (error) {
    logCosmosError("cosmosFetchOrdersForAnalytics", error)
    throw error
  }
}
