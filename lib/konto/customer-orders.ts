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
import {
  resolveCustomerTimelineStepIndex,
  resolveCustomerTrackingUrl,
} from "@/lib/konto/customer-order-timeline"

export type CustomerOrderSummary = {
  orderId: string
  createdAt: string
  status: StoredOrder["status"]
  statusLabel: string
  /** Kundenfreundlicher Gesamtstatus */
  customerStatusLabel: string
  productionStatus: string
  productionStatusLabel: string
  timelineStepIndex: number
  trackingNumber?: string
  trackingUrl?: string
  totalChf: number
  itemCount: number
  paymentMethodLabel: string
  hasInvoice: boolean
  canDownloadInvoice: boolean
  items: CustomerOrderItemView[]
}

function orderStatusLabel(status: StoredOrder["status"]): string {
  return ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

const TIMELINE_LABELS = [
  "Bestellt / Bereit für Produktion",
  "In Produktion",
  "Qualitätskontrolle",
  "Bereit für Versand / Verpackt",
  "Versendet",
] as const

/** Vereinfachter Status für das Kunden-Dashboard — synchron zum Cockpit-Fortschritt */
export function customerFacingOrderStatus(order: StoredOrder): string {
  if (order.status === "storniert") return "Storniert"

  const stepIndex = resolveCustomerTimelineStepIndex(order)
  return TIMELINE_LABELS[stepIndex] ?? orderStatusLabel(order.status)
}

function orderCanDownloadInvoice(order: StoredOrder): boolean {
  return order.paymentMethod === "invoice" || order.paymentConfirmed === true
}

function mapOrderToCustomerSummary(order: StoredOrder): CustomerOrderSummary {
  const production = resolveProductionStatus(order)
  const items = order.items.map((item) => mapOrderItemToCustomerView(item, order.orderId))
  const trackingUrl = resolveCustomerTrackingUrl(order)
  const canDownloadInvoice = orderCanDownloadInvoice(order)

  return {
    orderId: order.orderId,
    createdAt: order.createdAt,
    status: order.status,
    statusLabel: orderStatusLabel(order.status),
    customerStatusLabel: customerFacingOrderStatus(order),
    productionStatus: production,
    productionStatusLabel: productionStatusLabel(production),
    timelineStepIndex: resolveCustomerTimelineStepIndex(order),
    trackingNumber: order.trackingNumber,
    trackingUrl: trackingUrl ?? undefined,
    totalChf: order.totals.total,
    itemCount: order.items.length,
    paymentMethodLabel: order.paymentMethodLabel,
    hasInvoice: Boolean(order.rechnungPdfUrl || order.rechnungPdfPath),
    canDownloadInvoice,
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
