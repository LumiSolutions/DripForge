import type { OrderAddress } from "@/lib/dripforge/submit-order"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { isModernCustomerNumber } from "@/lib/admin/customer-number-config"
import {
  allocateNextCustomerNumber,
  isKundennummerTaken,
} from "@/lib/admin/customer-number-service"
import {
  getCustomersSnapshot,
  replaceCustomerForEmail,
  saveCustomer,
} from "@/lib/admin/customer-store"
import type { StoredCustomer } from "@/lib/admin/types"
import { getAccountByEmail, listAllAccounts, saveAccount } from "@/lib/konto/account-db"
import type { CustomerAccount } from "@/lib/konto/account-types"
import { isAccountDeleted } from "@/lib/konto/account-status"
import {
  getDefaultDeliveryAddress,
  normalizeDeliveryAddresses,
} from "@/lib/konto/delivery-addresses"

function accountToBilling(account: CustomerAccount): OrderAddress {
  return {
    firstName: account.firstName,
    lastName: account.lastName,
    street: account.street ?? "",
    zip: account.zip ?? "",
    city: account.city ?? "",
    country: "Schweiz",
    email: account.email,
    phone: account.phone ?? "",
  }
}

async function resolveKundennummerForAccount(
  account: CustomerAccount,
  existingCustomer: StoredCustomer | undefined
): Promise<string> {
  if (account.kundennummer) {
    return account.kundennummer
  }

  if (
    existingCustomer?.kundennummer &&
    isModernCustomerNumber(existingCustomer.kundennummer)
  ) {
    return existingCustomer.kundennummer
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = await allocateNextCustomerNumber()
    if (!(await isKundennummerTaken(candidate))) {
      return candidate
    }
  }

  throw new Error("Keine freie Kundennummer für das Kundenkonto gefunden.")
}

/** Legt CRM-Stammdaten an und vergibt ggf. eine neue Kundennummer. */
export async function syncAccountToCrm(
  account: CustomerAccount
): Promise<CustomerAccount> {
  if (isAccountDeleted(account.status)) {
    return account
  }

  const email = normalizeCustomerEmail(account.email)
  const customers = await getCustomersSnapshot()
  const existingCustomer =
    customers.find((c) => normalizeCustomerEmail(c.email) === email) ?? undefined

  const kundennummer = await resolveKundennummerForAccount(
    account,
    existingCustomer
  )

  const now = new Date().toISOString()
  const billing = accountToBilling(account)

  const deliveryAddresses = normalizeDeliveryAddresses(
    account.deliveryAddresses,
    {
      deliveryStreet: account.deliveryStreet,
      deliveryZip: account.deliveryZip,
      deliveryCity: account.deliveryCity,
      deliverySameAsBilling: account.deliverySameAsBilling,
    }
  )
  const defaultDelivery = getDefaultDeliveryAddress(deliveryAddresses)

  let delivery: StoredCustomer["delivery"] = existingCustomer?.delivery
  if (account.deliverySameAsBilling !== false && deliveryAddresses.length === 0) {
    delivery = undefined
  } else if (defaultDelivery) {
    delivery = {
      firstName:
        defaultDelivery.firstName?.trim() || billing.firstName,
      lastName: defaultDelivery.lastName?.trim() || billing.lastName,
      street: defaultDelivery.street,
      zip: defaultDelivery.zip,
      city: defaultDelivery.city,
      country: billing.country || "Schweiz",
      email: billing.email,
      phone: billing.phone,
    }
  }

  const customer: StoredCustomer = existingCustomer
    ? {
        ...existingCustomer,
        kundennummer,
        billing,
        delivery,
        deliveryAddresses,
        // Kategorie aus Portal übernehmen, falls CRM leer ist
        customerCategoryId:
          account.customerCategoryId?.trim() ||
          existingCustomer.customerCategoryId ||
          null,
        updatedAt: now,
      }
    : {
        kundennummer,
        email,
        billing,
        delivery,
        deliveryAddresses,
        orderIds: [],
        customerCategoryId: account.customerCategoryId?.trim() || null,
        createdAt: account.createdAt,
        updatedAt: now,
      }

  try {
    if (
      existingCustomer &&
      existingCustomer.kundennummer !== kundennummer
    ) {
      await replaceCustomerForEmail(email, customer, existingCustomer.kundennummer)
    } else {
      await saveCustomer(customer)
    }
  } catch (error) {
    // Ohne Cosmos: Portal-Konto (JSON) bleibt gültig — CRM-Write optional.
    console.warn(
      "CRM-Sync: Kunde konnte nicht gespeichert werden (Cosmos?). Portal-Konto bleibt erhalten.",
      error
    )
  }

  // CRM hat Kategorie, Portal nicht → Portal nachziehen
  const crmCategoryId = customer.customerCategoryId?.trim()
  if (
    crmCategoryId &&
    !account.customerCategoryId?.trim()
  ) {
    try {
      return await saveAccount({
        ...account,
        kundennummer:
          account.kundennummer !== kundennummer
            ? kundennummer
            : account.kundennummer,
        customerCategoryId: crmCategoryId,
      })
    } catch (error) {
      console.warn(
        "CRM-Sync: Kundenkategorie konnte lokal nicht persistiert werden.",
        error
      )
    }
  }

  if (account.kundennummer !== kundennummer) {
    try {
      return await saveAccount({ ...account, kundennummer })
    } catch (error) {
      console.warn(
        "CRM-Sync: Kundennummer konnte lokal nicht persistiert werden.",
        error
      )
      return { ...account, kundennummer }
    }
  }

  return account
}

/** Portal-Konten ohne CRM-Eintrag oder ohne Kundennummer nachziehen. */
export async function reconcilePortalAccounts(): Promise<void> {
  const accounts = await listAllAccounts()
  for (const account of accounts) {
    await syncAccountToCrm(account)
  }
}

export async function ensureAccountHasCustomerNumber(
  email: string
): Promise<CustomerAccount | null> {
  const account = await getAccountByEmail(email)
  if (!account) return null
  if (account.kundennummer && isModernCustomerNumber(account.kundennummer)) {
    return account
  }
  return syncAccountToCrm(account)
}
