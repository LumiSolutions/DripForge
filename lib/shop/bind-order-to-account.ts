import {
  buildCustomerFromOrder,
  generateCustomerNumber,
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
import { ensureAccountHasCustomerNumber, syncAccountToCrm } from "@/lib/konto/crm-sync"
import type { SavedDeliveryAddress } from "@/lib/konto/account-types"
import {
  newDeliveryAddressId,
  normalizeDeliveryAddresses,
} from "@/lib/konto/delivery-addresses"

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

function fallbackBindResult(
  order: StoredOrder,
  sessionEmail: string | null
): {
  customer: StoredCustomer
  accountEmail: string
  order: StoredOrder
} {
  const accountEmail =
    sessionEmail || normalizeCustomerEmail(order.billing.email)
  const kundennummer =
    order.kundennummer?.trim() || generateCustomerNumber([])
  const customer = buildCustomerFromOrder(
    {
      ...order,
      ...(sessionEmail ? { accountEmail: sessionEmail } : {}),
    },
    kundennummer
  )
  return {
    customer,
    accountEmail,
    order: sessionEmail ? { ...order, accountEmail: sessionEmail } : order,
  }
}

/**
 * Verknüpft eine Bestellung mit dem eingeloggten Konto (CRM + Kundennummer).
 * Formular-E-Mail wird nur als Kontakt auf der Bestellung belassen — kein neuer CRM-Kunde.
 *
 * CRM-/Konto-Fehler dürfen den Checkout NIE abbrechen — die Bestellung ist bereits gespeichert.
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

  try {
    if (sessionEmail) {
      let account =
        (await ensureAccountHasCustomerNumber(sessionEmail)) ??
        (await getAccountByEmail(sessionEmail))

      if (account) {
        try {
          account = await syncAccountToCrm(account)
        } catch (syncError) {
          console.error(
            `Bestellung: CRM-Sync fehlgeschlagen (${order.orderId}) — fahre mit Konto fort.`,
            syncError
          )
        }
        const kundennummer = account.kundennummer

        if (kundennummer) {
          let existing: StoredCustomer | null = null
          try {
            existing = await getCustomerByNumber(kundennummer)
          } catch (readError) {
            console.error(
              `Bestellung: Kunde ${kundennummer} nicht lesbar (${order.orderId}).`,
              readError
            )
          }

          const orderForCrm: StoredOrder = {
            ...order,
            billing: { ...order.billing, email: account.email },
            kundennummer,
            accountEmail: sessionEmail,
          }

          const customer: StoredCustomer = existing
            ? {
                ...mergeOrderIntoCustomer(existing, orderForCrm),
                email: normalizeCustomerEmail(account.email),
                kundennummer,
              }
            : buildCustomerFromOrder(orderForCrm, kundennummer)

          try {
            await saveCustomer(customer)
          } catch (crmError) {
            console.error(
              `Bestellung: CRM-Speichern fehlgeschlagen (${order.orderId}) — Bestellung bleibt erhalten.`,
              crmError
            )
          }

          const updatedOrder: StoredOrder = {
            ...order,
            kundennummer: customer.kundennummer,
            accountEmail: sessionEmail,
          }

          try {
            await saveOrder(updatedOrder)
          } catch (saveError) {
            console.error(
              `Bestellung: Kundennummer konnte nicht nachgetragen werden (${order.orderId}).`,
              saveError
            )
            return {
              customer,
              accountEmail: sessionEmail,
              order: updatedOrder,
            }
          }

          if (options?.saveAddressToAccount !== false) {
            try {
              const deliverySame = addressesMatch(order.billing, order.delivery)
              const delivery = order.delivery
              const existingAddresses = normalizeDeliveryAddresses(
                account.deliveryAddresses,
                {
                  deliveryStreet: account.deliveryStreet,
                  deliveryZip: account.deliveryZip,
                  deliveryCity: account.deliveryCity,
                  deliverySameAsBilling: account.deliverySameAsBilling,
                }
              )

              let nextAddresses = existingAddresses
              if (!deliverySame && delivery) {
                const street = delivery.street.trim()
                const zip = delivery.zip.trim()
                const city = delivery.city.trim()
                const match = existingAddresses.find(
                  (a) =>
                    a.street === street && a.zip === zip && a.city === city
                )
                if (match) {
                  nextAddresses = normalizeDeliveryAddresses(
                    existingAddresses.map((a) =>
                      a.id === match.id
                        ? {
                            ...a,
                            firstName:
                              delivery.firstName?.trim() || a.firstName,
                            lastName: delivery.lastName?.trim() || a.lastName,
                          }
                        : a
                    ),
                    undefined,
                    { defaultId: match.id }
                  )
                } else {
                  const entry: SavedDeliveryAddress = {
                    id: newDeliveryAddressId(),
                    label: "Lieferadresse",
                    street,
                    zip,
                    city,
                    isDefault: true,
                    ...(delivery.firstName?.trim()
                      ? { firstName: delivery.firstName.trim() }
                      : {}),
                    ...(delivery.lastName?.trim()
                      ? { lastName: delivery.lastName.trim() }
                      : {}),
                  }
                  nextAddresses = normalizeDeliveryAddresses(
                    [
                      ...existingAddresses.map((a) => ({
                        ...a,
                        isDefault: false,
                      })),
                      entry,
                    ],
                    undefined,
                    { defaultId: entry.id }
                  )
                }
              }

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
                deliveryAddresses: nextAddresses,
              })
              await syncAccountToCrm(saved)
            } catch (addressError) {
              console.error(
                `Bestellung: Adresse konnte nicht im Konto gespeichert werden (${order.orderId}).`,
                addressError
              )
            }
          }

          return {
            customer,
            accountEmail: sessionEmail,
            order: updatedOrder,
          }
        }

        console.error(
          `Bestellung: Konto ${sessionEmail} ohne Kundennummer — CRM-Fallback über Formular-E-Mail, accountEmail bleibt gesetzt.`
        )
      }
    }

    const customer = await upsertCustomerFromOrder(order)
    const updatedOrder: StoredOrder = {
      ...order,
      kundennummer: customer.kundennummer,
      ...(sessionEmail ? { accountEmail: sessionEmail } : {}),
    }
    if (
      updatedOrder.kundennummer !== order.kundennummer ||
      updatedOrder.accountEmail !== order.accountEmail
    ) {
      try {
        await saveOrder(updatedOrder)
      } catch (saveError) {
        console.error(
          `Bestellung: CRM-Verknüpfung konnte nicht nachgetragen werden (${order.orderId}).`,
          saveError
        )
      }
    }

    return {
      customer,
      accountEmail: sessionEmail || normalizeCustomerEmail(order.billing.email),
      order: updatedOrder,
    }
  } catch (error) {
    console.error(
      `Bestellung: Kundenbindung fehlgeschlagen (${order.orderId}) — Checkout läuft weiter.`,
      error
    )
    return fallbackBindResult(order, sessionEmail)
  }
}
