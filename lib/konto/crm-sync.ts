import type { OrderAddress } from "@/lib/dripforge/submit-order"
import {
  normalizeCustomerEmail,
} from "@/lib/admin/customers"
import { allocateNextCustomerNumber } from "@/lib/admin/customer-number-service"
import {
  getCustomersSnapshot,
  saveCustomer,
} from "@/lib/admin/customer-store"
import type { StoredCustomer } from "@/lib/admin/types"
import { getAccountByEmail, listAllAccounts, saveAccount } from "@/lib/konto/account-db"
import type { CustomerAccount } from "@/lib/konto/account-types"

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

/** Legt CRM-Stammdaten an und vergibt ggf. eine neue Kundennummer. */
export async function syncAccountToCrm(
  account: CustomerAccount
): Promise<CustomerAccount> {
  const email = normalizeCustomerEmail(account.email)
  const customers = await getCustomersSnapshot()
  const existingIdx = customers.findIndex((c) => c.email === email)

  let kundennummer =
    account.kundennummer ??
    (existingIdx >= 0 ? customers[existingIdx].kundennummer : undefined)

  if (!kundennummer) {
    kundennummer = await allocateNextCustomerNumber()
  }

  const now = new Date().toISOString()
  const billing = accountToBilling(account)

  const customer: StoredCustomer =
    existingIdx >= 0
      ? {
          ...customers[existingIdx],
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

  await saveCustomer(customer)

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
  if (account.kundennummer) return account
  return syncAccountToCrm(account)
}
