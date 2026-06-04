import { cosmosFetchOrdersForAnalytics } from "@/lib/admin/cosmos-analytics"
import { getOrders } from "@/lib/admin/db"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import type {
  AdminAnalytics,
  OrderAnalyticsRow,
} from "@/lib/admin/analytics-types"
import type { StoredOrder } from "@/lib/admin/types"

const OPEN_STATUSES = new Set(["ausstehend", "in_produktion"])
const CHART_DAYS = 90
const TOP_PRODUCTS_LIMIT = 10
const TOP_OPTIONS_LIMIT = 12

function toDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
  }).format(new Date(iso))
}

function isCancelled(status: string): boolean {
  return status === "storniert"
}

function orderTotalChf(order: OrderAnalyticsRow): number {
  const total = Number(order.totals?.total ?? 0)
  return Number.isFinite(total) ? total : 0
}

function mapStoredOrderToRow(order: StoredOrder): OrderAnalyticsRow {
  return {
    orderId: order.orderId,
    createdAt: order.createdAt,
    status: order.status,
    totals: {
      total: order.totals.total,
      subtotal: order.totals.subtotal,
    },
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      type: item.type,
      customDetails: item.customDetails,
    })),
  }
}

async function fetchOrderRows(): Promise<OrderAnalyticsRow[]> {
  return withCosmosFallback(
    "analytics:orders",
    cosmosFetchOrdersForAnalytics,
    async () => {
      const orders = await getOrders()
      return orders.map(mapStoredOrderToRow)
    }
  )
}

function bumpOption(
  map: Map<string, { label: string; category: string; count: number }>,
  category: string,
  raw: string | undefined
) {
  const label = raw?.trim()
  if (!label) return
  const key = `${category}::${label}`
  const existing = map.get(key)
  if (existing) {
    existing.count += 1
  } else {
    map.set(key, { label, category, count: 1 })
  }
}

export function aggregateOrderAnalytics(
  orders: OrderAnalyticsRow[]
): AdminAnalytics {
  let totalRevenueChf = 0
  let revenueOrderCount = 0
  let openOrderCount = 0

  const dayMap = new Map<string, { orders: number; revenueChf: number }>()
  const productMap = new Map<
    string,
    { name: string; quantity: number; revenueChf: number }
  >()
  const optionMap = new Map<
    string,
    { label: string; category: string; count: number }
  >()

  for (const order of orders) {
    if (OPEN_STATUSES.has(order.status)) {
      openOrderCount += 1
    }

    const cancelled = isCancelled(order.status)
    const total = orderTotalChf(order)

    if (!cancelled) {
      totalRevenueChf += total
      revenueOrderCount += 1

      const day = toDateKey(order.createdAt)
      const bucket = dayMap.get(day) ?? { orders: 0, revenueChf: 0 }
      bucket.orders += 1
      bucket.revenueChf += total
      dayMap.set(day, bucket)
    }

    for (const item of order.items ?? []) {
      const qty = Math.max(1, Number(item.quantity) || 1)
      const lineRevenue = Number(item.price) * qty
      const safeRevenue = Number.isFinite(lineRevenue) ? lineRevenue : 0

      if (!cancelled) {
        const productKey = item.name?.trim() || "Unbenannt"
        const product = productMap.get(productKey) ?? {
          name: productKey,
          quantity: 0,
          revenueChf: 0,
        }
        product.quantity += qty
        product.revenueChf += safeRevenue
        productMap.set(productKey, product)
      }

      const details = item.customDetails
      if (!details) continue

      bumpOption(optionMap, "Filament / Material", details.filament)
      bumpOption(optionMap, "Farbe", details.color)
      bumpOption(optionMap, "Farbwünsche", details.colorWishes)
      bumpOption(optionMap, "Laser-Material", details.material)
      bumpOption(optionMap, "Variante", details.variant ?? details.materialVariant)
    }
  }

  const sortedDays = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b))
  const recentCutoff =
    sortedDays.length > CHART_DAYS
      ? sortedDays[sortedDays.length - CHART_DAYS][0]
      : sortedDays[0]?.[0]

  const timeSeries = sortedDays
    .filter(([date]) => !recentCutoff || date >= recentCutoff)
    .map(([date, value]) => ({
      date,
      orders: value.orders,
      revenueChf: Math.round(value.revenueChf * 100) / 100,
    }))

  const topProducts = [...productMap.values()]
    .sort((a, b) => b.revenueChf - a.revenueChf || b.quantity - a.quantity)
    .slice(0, TOP_PRODUCTS_LIMIT)
    .map((p) => ({
      ...p,
      revenueChf: Math.round(p.revenueChf * 100) / 100,
    }))

  const topOptions = [...optionMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_OPTIONS_LIMIT)

  const averageOrderValueChf =
    revenueOrderCount > 0
      ? Math.round((totalRevenueChf / revenueOrderCount) * 100) / 100
      : 0

  return {
    summary: {
      totalRevenueChf: Math.round(totalRevenueChf * 100) / 100,
      orderCount: orders.length,
      openOrderCount,
      averageOrderValueChf,
    },
    timeSeries,
    topProducts,
    topOptions,
    generatedAt: new Date().toISOString(),
  }
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const rows = await fetchOrderRows()
  return aggregateOrderAnalytics(rows)
}
