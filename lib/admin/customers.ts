import type { OrderAddress } from "@/lib/dripforge/submit-order"
import type { StoredCustomer, StoredOrder } from "@/lib/admin/types"
import {
  normalizeAccountStatus,
  type CustomerAccountStatus,
} from "@/lib/konto/account-status"
import {
  findMaxSequenceInPool,
  formatCustomerNumber,
  getCustomerNumberYearPrefix,
  getYearBaseSequence,
} from "@/lib/admin/customer-number-config"

export {
  CUSTOMER_NUMBER_YEAR_BASE,
  formatCustomerNumber,
  getCustomerNumberYearPrefix,
  getYearBaseSequence,
  parseSequenceFromCustomerNumber,
  isModernCustomerNumber,
} from "@/lib/admin/customer-number-config"

export function normalizeCustomerEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Synchrone Vergabe für JSON-Fallback (strikt +1 pro Jahr-Praefix). */
export function generateCustomerNumber(
  existing: Array<{ kundennummer: string }>,
  referenceDate = new Date()
): string {
  const year = referenceDate.getFullYear()
  const yearPrefix = getCustomerNumberYearPrefix(referenceDate)
  const baseSequence = getYearBaseSequence(year)
  const max = findMaxSequenceInPool(existing, yearPrefix)
  const nextSequence = max === null ? baseSequence + 1 : max + 1
  return formatCustomerNumber(yearPrefix, nextSequence)
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
    billing:
      customer.status === "gelöscht" ? customer.billing : order.billing,
    delivery:
      customer.status === "gelöscht"
        ? customer.delivery
        : order.delivery ?? customer.delivery,
    orderIds,
    updatedAt: new Date().toISOString(),
  }
}

export type CustomerListItem = {
  kundennummer: string
  name: string
  email: string
  city: string
  firstName: string
  lastName: string
  street: string
  zip: string
  country: string
  orderCount: number
  status: CustomerAccountStatus
  createdAt: string
  updatedAt: string
}

export function toCustomerListItem(customer: StoredCustomer): CustomerListItem {
  return {
    kundennummer: customer.kundennummer,
    name: customerDisplayName(customer.billing),
    email: customer.email,
    city: customer.billing.city,
    firstName: customer.billing.firstName,
    lastName: customer.billing.lastName,
    street: customer.billing.street,
    zip: customer.billing.zip,
    country: customer.billing.country || "CH",
    orderCount: customer.orderIds.length,
    status: normalizeAccountStatus(customer.status),
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  }
}
