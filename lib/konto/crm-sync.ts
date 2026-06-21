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

  const customer: StoredCustomer = existingCustomer
    ? {
        ...existingCustomer,
        kundennummer,
        billing,
        updatedAt: now,
      }
    : {
        kundennummer,
        email,
        billing,
        orderIds: [],
        createdAt: account.createdAt,
        updatedAt: now,
      }

  if (
    existingCustomer &&
    existingCustomer.kundennummer !== kundennummer
  ) {
    await replaceCustomerForEmail(email, customer, existingCustomer.kundennummer)
  } else {
    await saveCustomer(customer)
  }

  if (account.kundennummer !== kundennummer) {
    return saveAccount({ ...account, kundennummer })
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
