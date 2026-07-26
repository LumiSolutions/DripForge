import {
  buildCustomerFromOrder,
  mergeOrderIntoCustomer,
  normalizeCustomerEmail,
} from "@/lib/admin/customers"
import {
  getCustomerByNumber,
  saveOrder,
  upsertCustomerFromOrder,
} from "@/lib/admin/db"
import { saveCustomer } from "@/lib/admin/customer-store"
import type { StoredCustomer, StoredOrder } from "@/lib/admin/types"
import { getAccountByEmail, saveAccount } from "@/lib/konto/account-db"
import { syncAccountToCrm } from "@/lib/konto/crm-sync"

export function resolveLoyaltyAccountEmail(
  sessionEmail: string | null | undefined,
  billingEmail: string
): string {
  const session = sessionEmail?.trim().toLowerCase()
  if (session) return session
  return normalizeCustomerEmail(billingEmail)
}

function addressesMatch(
  a: StoredOrder["billing"],
  b: StoredOrder["delivery"] | undefined
): boolean {
  if (!b) return true
  return (
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.street === b.street &&
    a.zip === b.zip &&
    a.city === b.city &&
    a.country === b.country
  )
}

/**
 * Verknüpft eine Bestellung mit dem eingeloggten Konto (CRM + Kundennummer).
 * Formular-E-Mail wird nur als Kontakt auf der Bestellung belassen — kein neuer CRM-Kunde.
 */
export async function bindOrderToCustomer(
  order: StoredOrder,
  options?: {
    sessionEmail?: string | null
    /** Default true wenn Session vorhanden */
    saveAddressToAccount?: boolean
  }
): Promise<{
  customer: StoredCustomer
  accountEmail: string
  order: StoredOrder
}> {
  const sessionEmail = options?.sessionEmail?.trim().toLowerCase() || null

  if (sessionEmail) {
    let account = await getAccountByEmail(sessionEmail)
    if (account) {
      account = await syncAccountToCrm(account)
      const kundennummer = account.kundennummer
      if (!kundennummer) {
        throw new Error("Kundenkonto hat keine Kundennummer.")
      }

      let existing = await getCustomerByNumber(kundennummer)

      // CRM-Merge mit Account-E-Mail (nicht Formular-E-Mail), damit kein Zweitkunde entsteht
      const orderForCrm: StoredOrder = {
        ...order,
        billing: { ...order.billing, email: account.email },
        kundennummer,
      }

      let customer: StoredCustomer
      if (existing) {
        customer = {
          ...mergeOrderIntoCustomer(existing, orderForCrm),
          email: normalizeCustomerEmail(account.email),
          kundennummer,
        }
      } else {
        customer = buildCustomerFromOrder(orderForCrm, kundennummer)
      }

      await saveCustomer(customer)

      const updatedOrder: StoredOrder = {
        ...order,
        kundennummer: customer.kundennummer,
        accountEmail: sessionEmail,
      }
      await saveOrder(updatedOrder)

      if (options?.saveAddressToAccount !== false) {
        const deliverySame = addressesMatch(order.billing, order.delivery)
        const delivery = order.delivery
        const saved = await saveAccount({
          ...account,
          firstName: order.billing.firstName.trim(),
          lastName: order.billing.lastName.trim(),
          street: order.billing.street.trim(),
          zip: order.billing.zip.trim(),
          city: order.billing.city.trim(),
          phone: order.billing.phone.trim(),
          deliverySameAsBilling: deliverySame,
          deliveryStreet: deliverySame
            ? order.billing.street.trim()
            : (delivery?.street ?? "").trim(),
          deliveryZip: deliverySame
            ? order.billing.zip.trim()
            : (delivery?.zip ?? "").trim(),
          deliveryCity: deliverySame
            ? order.billing.city.trim()
            : (delivery?.city ?? "").trim(),
        })
        await syncAccountToCrm(saved)
      }

      return {
        customer,
        accountEmail: sessionEmail,
        order: updatedOrder,
      }
    }
  }

  const customer = await upsertCustomerFromOrder(order)
  const updatedOrder: StoredOrder = {
    ...order,
    kundennummer: customer.kundennummer,
  }
  if (updatedOrder.kundennummer !== order.kundennummer) {
    await saveOrder(updatedOrder)
  }

  return {
    customer,
    accountEmail: normalizeCustomerEmail(order.billing.email),
    order: updatedOrder,
  }
}
