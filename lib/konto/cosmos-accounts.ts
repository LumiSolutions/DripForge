import { getCustomerAccountsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import type { CustomerAccount } from "@/lib/konto/account-types"
import { normalizeCustomerEmail } from "@/lib/admin/customers"

type CosmosDoc<T> = T & { id: string }

export async function cosmosGetAccountByEmail(
  email: string
): Promise<CustomerAccount | null> {
  const id = normalizeCustomerEmail(email)
  if (!id) return null

  const container = await getCustomerAccountsContainer()
  try {
    const { resource: doc } = await container
      .item(id, id)
      .read<CosmosDoc<CustomerAccount>>()
    if (!doc) return null
    return {
      id: doc.id,
      email: doc.email,
      passwordHash: doc.passwordHash,
      firstName: doc.firstName,
      lastName: doc.lastName,
      street: doc.street ?? "",
      zip: doc.zip ?? "",
      city: doc.city ?? "",
      phone: doc.phone ?? "",
      kundennummer: doc.kundennummer,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetAccountByEmail:${id}`, error)
    throw error
  }
}

export async function cosmosUpsertAccount(
  account: CustomerAccount
): Promise<CustomerAccount> {
  const container = await getCustomerAccountsContainer()
  await container.items.upsert({ ...account, id: account.id })
  return account
}
