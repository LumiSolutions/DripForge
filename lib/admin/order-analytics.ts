import { cosmosFetchOrdersForAnalytics } from "@/lib/admin/cosmos-analytics"
import { getOrders } from "@/lib/admin/db"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import type {
  AdminAnalytics,
  OrderAnalyticsRow,
} from "@/lib/admin/analytics-types"
import type { StoredOrder } from "@/lib/admin/types"

const OPEN_STATUSES = new Set(["ausstehend", "in_produktion"])
const DEFAULT_CHART_DAYS = 90
const ALLOWED_CHART_DAYS = new Set([30, 90, 365])
const TOP_PRODUCTS_LIMIT = 10
const TOP_OPTIONS_LIMIT = 12
const TOP_BUYERS_LIMIT = 10

export function normalizeAnalyticsChartDays(value: unknown): number {
  const n = Number(value)
  if (ALLOWED_CHART_DAYS.has(n)) return n
  return DEFAULT_CHART_DAYS
}

function toDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
  }).format(new Date(iso))
}

function isCancelled(status: string): boolean {
  return status === "storniert"
}

/** Umsatz nur aus bezahlten Bestellungen (aligniert mit Buchhaltungs-Journal). */
export function isPaidOrderForRevenue(order: OrderAnalyticsRow): boolean {
  if (isCancelled(order.status)) return false
  if (order.paymentConfirmed === true) return true
  if (order.paymentStatus === "paid") return true
  return false
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
    paymentConfirmed: order.paymentConfirmed,
    paymentStatus: order.paymentStatus,
    billing: {
      firstName: order.billing.firstName,
      lastName: order.billing.lastName,
      email: order.billing.email,
    },
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

function buyerDisplayName(billing: OrderAnalyticsRow["billing"], email: string): string {
  const firstName = billing?.firstName?.trim() ?? ""
  const lastName = billing?.lastName?.trim() ?? ""
  const fullName = [firstName, lastName].filter(Boolean).join(" ")
  return fullName || email
}

function buyerEmailKey(billing: OrderAnalyticsRow["billing"]): string | null {
  const email = billing?.email?.trim().toLowerCase()
  return email || null
}

export function aggregateOrderAnalytics(
  orders: OrderAnalyticsRow[],
  chartDays: number = DEFAULT_CHART_DAYS
): AdminAnalytics {
  const seriesDays = normalizeAnalyticsChartDays(chartDays)
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
  const buyerMap = new Map<
    string,
    { name: string; email: string; orderCount: number; revenueChf: number }
  >()

  for (const order of orders) {
    if (OPEN_STATUSES.has(order.status) && !isCancelled(order.status)) {
      openOrderCount += 1
    }

    const cancelled = isCancelled(order.status)
    const countsForRevenue = isPaidOrderForRevenue(order)
    const total = orderTotalChf(order)

    if (countsForRevenue) {
      totalRevenueChf += total
      revenueOrderCount += 1

      const day = toDateKey(order.createdAt)
      const bucket = dayMap.get(day) ?? { orders: 0, revenueChf: 0 }
      bucket.orders += 1
      bucket.revenueChf += total
      dayMap.set(day, bucket)

      const emailKey = buyerEmailKey(order.billing)
      if (emailKey) {
        const displayEmail = order.billing?.email?.trim() ?? emailKey
        const buyer = buyerMap.get(emailKey) ?? {
          name: buyerDisplayName(order.billing, displayEmail),
          email: displayEmail,
          orderCount: 0,
          revenueChf: 0,
        }
        buyer.orderCount += 1
        buyer.revenueChf += total
        const name = buyerDisplayName(order.billing, displayEmail)
        if (name && name !== displayEmail) {
          buyer.name = name
        }
        buyerMap.set(emailKey, buyer)
      }
    }

    for (const item of order.items ?? []) {
      const qty = Math.max(1, Number(item.quantity) || 1)
      const lineRevenue = Number(item.price) * qty
      const safeRevenue = Number.isFinite(lineRevenue) ? lineRevenue : 0

      if (countsForRevenue) {
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

      if (cancelled || !countsForRevenue) continue

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
    sortedDays.length > seriesDays
      ? sortedDays[sortedDays.length - seriesDays][0]
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

  const topBuyers = [...buyerMap.values()]
    .sort((a, b) => b.revenueChf - a.revenueChf || b.orderCount - a.orderCount)
    .slice(0, TOP_BUYERS_LIMIT)
    .map((buyer) => ({
      ...buyer,
      revenueChf: Math.round(buyer.revenueChf * 100) / 100,
    }))

  const averageOrderValueChf =
    revenueOrderCount > 0
      ? Math.round((totalRevenueChf / revenueOrderCount) * 100) / 100
      : 0

  return {
    summary: {
      totalRevenueChf: Math.round(totalRevenueChf * 100) / 100,
      // Nur bezahlte Bestellungen (paymentConfirmed / paid) — Storno/Entwurf raus
      orderCount: revenueOrderCount,
      openOrderCount,
      averageOrderValueChf,
    },
    timeSeries,
    topProducts,
    topOptions,
    topBuyers,
    generatedAt: new Date().toISOString(),
  }
}

export async function getAdminAnalytics(
  chartDays: number = DEFAULT_CHART_DAYS
): Promise<AdminAnalytics> {
  const rows = await fetchOrderRows()
  return aggregateOrderAnalytics(rows, chartDays)
}
