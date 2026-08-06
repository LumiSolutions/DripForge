import type { StoredOrder } from "@/lib/admin/types"
import { SHIPPING_OPTIONS } from "@/lib/dripforge/checkout-config"

type FulfillmentLikeOrder = Pick<StoredOrder, "shippingMethod"> & {
  shipping_method?: string | null
  fulfillmentType?: string | null
  fulfillment_type?: string | null
}

const HANDOFF_METHODS = new Set([
  "pickup",
  "abholung",
  "abholen",
  "collection",
  "handoff",
  "directhandoff",
  "direktuebergabe",
  "direktubergabe",
  "uebergabe",
  "ubergabe",
  "local",
  "localdelivery",
  "lokal",
  "lokalezustellung",
  "lokallieferung",
])

function normalizeFulfillmentValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
}

function fulfillmentValues(order: FulfillmentLikeOrder): string[] {
  return [
    order.shippingMethod,
    order.shipping_method,
    order.fulfillmentType,
    order.fulfillment_type,
  ]
    .map(normalizeFulfillmentValue)
    .filter(Boolean)
}

export function isHandoffFulfillment(order: FulfillmentLikeOrder): boolean {
  return fulfillmentValues(order).some((value) => HANDOFF_METHODS.has(value))
}

export function shouldCollectPostTracking(order: FulfillmentLikeOrder): boolean {
  return !isHandoffFulfillment(order)
}

export function resolveOrderFulfillmentLabel(order: FulfillmentLikeOrder): string {
  const option = SHIPPING_OPTIONS.find((entry) => entry.id === order.shippingMethod)
  if (option) return option.label
  return (
    order.shipping_method ??
    order.fulfillmentType ??
    order.fulfillment_type ??
    order.shippingMethod
  )
}
