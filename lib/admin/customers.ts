import type { OrderAddress } from "@/lib/dripforge/submit-order"
import type { StoredCustomer, StoredOrder } from "@/lib/admin/types"

export function normalizeCustomerEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function generateCustomerNumber(existing: StoredCustomer[]): string {
  const year = new Date().getFullYear()
  const prefix = `KD-${year}-`
  let max = 0

  for (const customer of existing) {
    if (!customer.kundennummer.startsWith(prefix)) continue
    const suffix = customer.kundennummer.slice(prefix.length)
    const parsed = parseInt(suffix, 10)
    if (!Number.isNaN(parsed)) {
      max = Math.max(max, parsed)
    }
  }

  return `${prefix}${String(max + 1).padStart(4, "0")}`
}

export function customerDisplayName(billing: OrderAddress): string {
  return `${billing.firstName} ${billing.lastName}`.trim()
}

export function buildCustomerFromOrder(
  order: StoredOrder,
  kundennummer: string
): StoredCustomer {
  return {
    kundennummer,
    email: normalizeCustomerEmail(order.billing.email),
    billing: order.billing,
    delivery: order.delivery,
    orderIds: [order.orderId],
    createdAt: order.createdAt,
    updatedAt: order.createdAt,
  }
}

export function mergeOrderIntoCustomer(
  customer: StoredCustomer,
  order: StoredOrder
): StoredCustomer {
  const orderIds = customer.orderIds.includes(order.orderId)
    ? customer.orderIds
    : [...customer.orderIds, order.orderId]

  return {
    ...customer,
    billing: order.billing,
    delivery: order.delivery ?? customer.delivery,
    orderIds,
    updatedAt: new Date().toISOString(),
  }
}

export type CustomerListItem = {
  kundennummer: string
  name: string
  email: string
  city: string
  orderCount: number
  updatedAt: string
}

export function toCustomerListItem(customer: StoredCustomer): CustomerListItem {
  return {
    kundennummer: customer.kundennummer,
    name: customerDisplayName(customer.billing),
    email: customer.email,
    city: customer.billing.city,
    orderCount: customer.orderIds.length,
    updatedAt: customer.updatedAt,
  }
}
