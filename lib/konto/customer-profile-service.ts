import {
  getAccountByEmail,
  isActiveCustomerAccount,
  saveAccount,
  toPublicAccount,
} from "@/lib/konto/account-db"
import type { CustomerAccount } from "@/lib/konto/account-types"
import type { LoyaltyPointTransaction } from "@/lib/konto/loyalty-points-config"
import { ensureAccountHasCustomerNumber, syncAccountToCrm } from "@/lib/konto/crm-sync"

export type CustomerAddressInput = {
  street: string
  zip: string
  city: string
  phone: string
  deliveryStreet: string
  deliveryZip: string
  deliveryCity: string
  deliverySameAsBilling: boolean
}

export type CustomerProfileResponse = ReturnType<typeof toPublicAccount> & {
  loyaltyPointHistory: LoyaltyPointTransaction[]
}

export function parseCustomerAddressInput(body: unknown): CustomerAddressInput | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>
  return {
    street: typeof b.street === "string" ? b.street.trim() : "",
    zip: typeof b.zip === "string" ? b.zip.trim() : "",
    city: typeof b.city === "string" ? b.city.trim() : "",
    phone: typeof b.phone === "string" ? b.phone.trim() : "",
    deliveryStreet: typeof b.deliveryStreet === "string" ? b.deliveryStreet.trim() : "",
    deliveryZip: typeof b.deliveryZip === "string" ? b.deliveryZip.trim() : "",
    deliveryCity: typeof b.deliveryCity === "string" ? b.deliveryCity.trim() : "",
    deliverySameAsBilling: b.deliverySameAsBilling === true,
  }
}

function sortLoyaltyHistory(account: CustomerAccount): LoyaltyPointTransaction[] {
  return [...(account.loyaltyPointTransactions ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function toCustomerProfileResponse(account: CustomerAccount): CustomerProfileResponse {
  return {
    ...toPublicAccount(account),
    loyaltyPointHistory: sortLoyaltyHistory(account),
  }
}

export async function getCustomerProfile(
  email: string
): Promise<CustomerProfileResponse | null> {
  const account = await ensureAccountHasCustomerNumber(email)
  if (!account || !isActiveCustomerAccount(account)) return null
  return toCustomerProfileResponse(account)
}

export async function updateCustomerAddress(
  email: string,
  input: CustomerAddressInput
): Promise<CustomerProfileResponse | null> {
  const account = await getAccountByEmail(email)
  if (!account || !isActiveCustomerAccount(account)) return null

  const saved = await saveAccount({
    ...account,
    street: input.street,
    zip: input.zip,
    city: input.city,
    phone: input.phone,
    deliveryStreet: input.deliverySameAsBilling ? input.street : input.deliveryStreet,
    deliveryZip: input.deliverySameAsBilling ? input.zip : input.deliveryZip,
    deliveryCity: input.deliverySameAsBilling ? input.city : input.deliveryCity,
    deliverySameAsBilling: input.deliverySameAsBilling,
  })
  const synced = await syncAccountToCrm(saved)
  return toCustomerProfileResponse(synced)
}
