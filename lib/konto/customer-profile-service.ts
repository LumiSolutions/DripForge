import {
  getAccountByEmail,
  isActiveCustomerAccount,
  saveAccount,
  toPublicAccount,
} from "@/lib/konto/account-db"
import type { CustomerAccount, SavedDeliveryAddress } from "@/lib/konto/account-types"
import type { LoyaltyPointTransaction } from "@/lib/konto/loyalty-points-config"
import { ensureAccountHasCustomerNumber, syncAccountToCrm } from "@/lib/konto/crm-sync"
import {
  legacyFieldsFromDeliveryAddresses,
  normalizeDeliveryAddresses,
  parseSavedDeliveryAddresses,
} from "@/lib/konto/delivery-addresses"

export type CustomerAddressInput = {
  street: string
  zip: string
  city: string
  phone: string
  deliveryStreet: string
  deliveryZip: string
  deliveryCity: string
  deliverySameAsBilling: boolean
  deliveryAddresses?: SavedDeliveryAddress[]
  defaultDeliveryAddressId?: string
}

export type CustomerProfileResponse = ReturnType<typeof toPublicAccount> & {
  loyaltyPointHistory: LoyaltyPointTransaction[]
}

export function parseCustomerAddressInput(body: unknown): CustomerAddressInput | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>

  const deliveryAddressesRaw = parseSavedDeliveryAddresses(b.deliveryAddresses)
  const hasDeliveryAddressesField = "deliveryAddresses" in b
  const defaultDeliveryAddressId =
    typeof b.defaultDeliveryAddressId === "string"
      ? b.defaultDeliveryAddressId.trim()
      : undefined

  return {
    street: typeof b.street === "string" ? b.street.trim() : "",
    zip: typeof b.zip === "string" ? b.zip.trim() : "",
    city: typeof b.city === "string" ? b.city.trim() : "",
    phone: typeof b.phone === "string" ? b.phone.trim() : "",
    deliveryStreet: typeof b.deliveryStreet === "string" ? b.deliveryStreet.trim() : "",
    deliveryZip: typeof b.deliveryZip === "string" ? b.deliveryZip.trim() : "",
    deliveryCity: typeof b.deliveryCity === "string" ? b.deliveryCity.trim() : "",
    deliverySameAsBilling: b.deliverySameAsBilling === true,
    deliveryAddresses: hasDeliveryAddressesField ? deliveryAddressesRaw : undefined,
    defaultDeliveryAddressId: defaultDeliveryAddressId || undefined,
  }
}

function sortLoyaltyHistory(account: CustomerAccount): LoyaltyPointTransaction[] {
  return [...(account.loyaltyPointTransactions ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function toCustomerProfileResponse(
  account: CustomerAccount,
  options?: { pointValueChf?: number }
): CustomerProfileResponse {
  return {
    ...toPublicAccount(account, options),
    loyaltyPointHistory: sortLoyaltyHistory(account),
  }
}

export async function getCustomerProfile(
  email: string
): Promise<CustomerProfileResponse | null> {
  const account = await ensureAccountHasCustomerNumber(email)
  if (!account || !isActiveCustomerAccount(account)) return null
  const { grantLoyaltyPointsForPaidOrdersForCustomerEmail } = await import(
    "@/lib/shop/paid-order-loyalty"
  )
  await grantLoyaltyPointsForPaidOrdersForCustomerEmail(email)
  const refreshed = (await getAccountByEmail(email)) ?? account
  const { getSettings } = await import("@/lib/admin/db")
  const { buildRewardPointsPublicSettings } = await import(
    "@/lib/dripforge/reward-points-settings"
  )
  const { syncLoyaltyAccountBalance } = await import("@/lib/konto/loyalty-points")
  const rewardCfg = buildRewardPointsPublicSettings(await getSettings())
  const synced =
    (await syncLoyaltyAccountBalance(
      email,
      rewardCfg.loyaltyPointsExpiryMonths
    )) ?? refreshed
  return toCustomerProfileResponse(synced, {
    pointValueChf: rewardCfg.loyaltyPointValueChf,
  })
}

export async function updateCustomerAddress(
  email: string,
  input: CustomerAddressInput
): Promise<CustomerProfileResponse | null> {
  const account = await getAccountByEmail(email)
  if (!account || !isActiveCustomerAccount(account)) return null

  const billing = {
    street: input.street,
    zip: input.zip,
    city: input.city,
  }

  let deliveryAddresses: SavedDeliveryAddress[]
  let deliverySameAsBilling = input.deliverySameAsBilling
  let deliveryStreet: string
  let deliveryZip: string
  let deliveryCity: string

  if (input.deliveryAddresses !== undefined) {
    // Leeres Array nur übernehmen, wenn explizit «wie Rechnung» (kein Wipe durch Race).
    const incoming = normalizeDeliveryAddresses(
      input.deliveryAddresses,
      undefined,
      { defaultId: input.defaultDeliveryAddressId }
    )
    const existingNormalized = normalizeDeliveryAddresses(
      account.deliveryAddresses,
      {
        deliveryStreet: account.deliveryStreet,
        deliveryZip: account.deliveryZip,
        deliveryCity: account.deliveryCity,
        deliverySameAsBilling: account.deliverySameAsBilling,
      }
    )
    deliveryAddresses =
      incoming.length === 0 &&
      existingNormalized.length > 0 &&
      input.deliverySameAsBilling !== true
        ? existingNormalized
        : incoming
    const legacy = legacyFieldsFromDeliveryAddresses(deliveryAddresses, billing)
    deliveryStreet = legacy.deliveryStreet ?? ""
    deliveryZip = legacy.deliveryZip ?? ""
    deliveryCity = legacy.deliveryCity ?? ""
    deliverySameAsBilling =
      deliveryAddresses.length === 0 ? true : (legacy.deliverySameAsBilling ?? false)
  } else if (input.deliverySameAsBilling) {
    deliveryAddresses = normalizeDeliveryAddresses(account.deliveryAddresses)
    deliveryStreet = input.street
    deliveryZip = input.zip
    deliveryCity = input.city
    deliverySameAsBilling = true
  } else {
    // Legacy single-address update: upsert into the address list as default.
    const existing = normalizeDeliveryAddresses(account.deliveryAddresses, {
      deliveryStreet: account.deliveryStreet,
      deliveryZip: account.deliveryZip,
      deliveryCity: account.deliveryCity,
      deliverySameAsBilling: account.deliverySameAsBilling,
    })
    const defaultExisting = existing.find((a) => a.isDefault) ?? existing[0]
    const nextSingle = {
      id: defaultExisting?.id ?? `legacy-${Date.now()}`,
      label: defaultExisting?.label ?? "Lieferadresse",
      street: input.deliveryStreet,
      zip: input.deliveryZip,
      city: input.deliveryCity,
      isDefault: true,
    }
    deliveryAddresses = normalizeDeliveryAddresses(
      existing.length === 0
        ? [nextSingle]
        : existing.map((a) =>
            a.id === nextSingle.id
              ? { ...nextSingle, isDefault: true }
              : { ...a, isDefault: false }
          ),
      undefined,
      { defaultId: nextSingle.id }
    )
    deliveryStreet = input.deliveryStreet
    deliveryZip = input.deliveryZip
    deliveryCity = input.deliveryCity
    deliverySameAsBilling = false
  }

  const saved = await saveAccount({
    ...account,
    street: input.street,
    zip: input.zip,
    city: input.city,
    phone: input.phone,
    deliveryStreet,
    deliveryZip,
    deliveryCity,
    deliverySameAsBilling,
    deliveryAddresses,
  })

  let synced = saved
  try {
    synced = await syncAccountToCrm(saved)
  } catch (error) {
    // Profil speichern muss ohne Cosmos gelingen (JSON-Fallback).
    console.warn(
      "Profil: CRM-Sync nach Adress-Update fehlgeschlagen — gespeichertes Konto wird zurückgegeben.",
      error
    )
  }

  const { getSettings } = await import("@/lib/admin/db")
  const { buildRewardPointsPublicSettings } = await import(
    "@/lib/dripforge/reward-points-settings"
  )
  const rewardCfg = buildRewardPointsPublicSettings(await getSettings())
  return toCustomerProfileResponse(synced, {
    pointValueChf: rewardCfg.loyaltyPointValueChf,
  })
}
