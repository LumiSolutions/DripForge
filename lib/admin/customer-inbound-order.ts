import type { StoredOrder, StoredOrderItem } from "@/lib/admin/types"

export const CUSTOMER_INBOUND_PRODUCTION_LABEL =
  "Wartet auf Einsendung des Kunden"

export function cartItemIsCustomerInbound(item: StoredOrderItem): boolean {
  return (
    item.customDetails?.isCustomerInbound === true ||
    item.customDetails?.customerShipping === true
  )
}

export function orderHasCustomerInbound(items: StoredOrderItem[]): boolean {
  return items.some(cartItemIsCustomerInbound)
}

export function isCustomerInboundOrder(order: StoredOrder): boolean {
  return order.isCustomerInbound === true || orderHasCustomerInbound(order.items)
}
