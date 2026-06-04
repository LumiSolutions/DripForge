import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { getOrders } from "@/lib/admin/db"
import {
  productionStatusLabel,
  resolveProductionStatus,
} from "@/lib/admin/production-status"
import { ORDER_STATUS_OPTIONS, type StoredOrder } from "@/lib/admin/types"

export type CustomerOrderSummary = {
  orderId: string
  createdAt: string
  status: StoredOrder["status"]
  statusLabel: string
  productionStatus: string
  productionStatusLabel: string
  totalChf: number
  itemCount: number
  paymentMethodLabel: string
}

function orderStatusLabel(status: StoredOrder["status"]): string {
  return ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

/** Nur Bestellungen, deren Rechnungs-E-Mail mit dem Konto uebereinstimmt. */
export async function getOrdersForCustomerEmail(
  email: string
): Promise<CustomerOrderSummary[]> {
  const normalized = normalizeCustomerEmail(email)
  const allOrders = await getOrders()

  const matched = allOrders.filter(
    (order) => normalizeCustomerEmail(order.billing.email) === normalized
  )

  return matched
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .map((order) => {
      const production = resolveProductionStatus(order)
      return {
        orderId: order.orderId,
        createdAt: order.createdAt,
        status: order.status,
        statusLabel: orderStatusLabel(order.status),
        productionStatus: production,
        productionStatusLabel: productionStatusLabel(production),
        totalChf: order.totals.total,
        itemCount: order.items.length,
        paymentMethodLabel: order.paymentMethodLabel,
      }
    })
}

export async function getOrderForCustomerEmail(
  email: string,
  orderId: string
): Promise<StoredOrder | null> {
  const normalized = normalizeCustomerEmail(email)
  const orders = await getOrders()
  const order = orders.find((o) => o.orderId === orderId)
  if (!order) return null
  if (normalizeCustomerEmail(order.billing.email) !== normalized) return null
  return order
}
