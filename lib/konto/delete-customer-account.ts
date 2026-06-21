import { randomBytes } from "crypto"
import type { OrderAddress } from "@/lib/dripforge/submit-order"
import { getCustomerByNumber } from "@/lib/admin/db"
import { saveCustomer } from "@/lib/admin/customer-store"
import type { StoredCustomer } from "@/lib/admin/types"
import { saveAccount } from "@/lib/konto/account-db"
import type { CustomerAccount } from "@/lib/konto/account-types"
import {
  buildDeletedPlaceholderEmail,
  isAccountDeleted,
} from "@/lib/konto/account-status"
import { hashPassword } from "@/lib/konto/password"

const DELETED_FIRST_NAME = "Gelöschter"
const DELETED_LAST_NAME = "Kunde"

function buildAnonymousBilling(email: string): OrderAddress {
  return {
    firstName: DELETED_FIRST_NAME,
    lastName: DELETED_LAST_NAME,
    street: "—",
    zip: "0000",
    city: "—",
    country: "Schweiz",
    email,
    phone: "",
  }
}

async function anonymizeCrmCustomer(
  kundennummer: string,
  placeholderEmail: string
): Promise<void> {
  const customer = await getCustomerByNumber(kundennummer)
  if (!customer) return

  const billing = buildAnonymousBilling(placeholderEmail)
  const next: StoredCustomer = {
    ...customer,
    email: placeholderEmail,
    billing,
    delivery: undefined,
    status: "gelöscht",
    updatedAt: new Date().toISOString(),
  }

  await saveCustomer(next)
}

/** Soft-Delete: Status setzen, PII anonymisieren, Kundennummer & Bestellungen behalten. */
export async function softDeleteCustomerAccount(
  account: CustomerAccount
): Promise<CustomerAccount> {
  if (isAccountDeleted(account.status)) {
    throw new Error("Dieses Konto wurde bereits gelöscht.")
  }

  const now = new Date().toISOString()
  const placeholderEmail = buildDeletedPlaceholderEmail(
    account.kundennummer,
    account.id
  )

  const deleted: CustomerAccount = {
    ...account,
    id: account.id,
    status: "gelöscht",
    email: placeholderEmail,
    firstName: DELETED_FIRST_NAME,
    lastName: DELETED_LAST_NAME,
    street: "",
    zip: "",
    city: "",
    phone: "",
    passwordHash: hashPassword(randomBytes(32).toString("hex")),
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    deletedAt: now,
    updatedAt: now,
  }

  const saved = await saveAccount(deleted)

  if (account.kundennummer) {
    await anonymizeCrmCustomer(account.kundennummer, placeholderEmail)
  }

  return saved
}
