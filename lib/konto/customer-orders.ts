import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { getOrders } from "@/lib/admin/db"
import {
  productionStatusLabel,
  resolveProductionStatus,
} from "@/lib/admin/production-status"
import { ORDER_STATUS_OPTIONS, type StoredOrder } from "@/lib/admin/types"
import {
  mapOrderItemToCustomerView,
  type CustomerOrderItemView,
} from "@/lib/konto/format-order-item"

export type CustomerOrderSummary = {
  orderId: string
  createdAt: string
  status: StoredOrder["status"]
  statusLabel: string
  /** Kundenfreundlicher Gesamtstatus */
  customerStatusLabel: string
  productionStatus: string
  productionStatusLabel: string
  totalChf: number
  itemCount: number
  paymentMethodLabel: string
  hasInvoice: boolean
  items: CustomerOrderItemView[]
}

function orderStatusLabel(status: StoredOrder["status"]): string {
  return ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

/** Vereinfachter Status für das Kunden-Dashboard */
export function customerFacingOrderStatus(order: StoredOrder): string {
  if (order.status === "storniert") return "Storniert"
  if (order.status === "versendet") return "Versendet"

  const production = resolveProductionStatus(order)
  if (production === "bereit_fuer_versand") return "Versandbereit"
  if (production === "qualitaetskontrolle") return "Qualitätskontrolle"
  if (production === "in_produktion") return "In Produktion"

  if (order.status === "in_produktion") return "In Produktion"
  if (order.status === "ausstehend") return "Bestätigt"

  return orderStatusLabel(order.status)
}

function mapOrderToCustomerSummary(order: StoredOrder): CustomerOrderSummary {
  const production = resolveProductionStatus(order)
  const items = order.items.map(mapOrderItemToCustomerView)

  return {
    orderId: order.orderId,
    createdAt: order.createdAt,
    status: order.status,
    statusLabel: orderStatusLabel(order.status),
    customerStatusLabel: customerFacingOrderStatus(order),
    productionStatus: production,
    productionStatusLabel: productionStatusLabel(production),
    totalChf: order.totals.total,
    itemCount: order.items.length,
    paymentMethodLabel: order.paymentMethodLabel,
    hasInvoice: Boolean(order.rechnungPdfUrl || order.rechnungPdfPath),
    items,
  }
}

/** Nur Bestellungen, deren Rechnungs-E-Mail mit dem Konto übereinstimmt. */
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
    .map(mapOrderToCustomerSummary)
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
