import { getCustomerAccountsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import type { CustomerAccount } from "@/lib/konto/account-types"
import { CUSTOMER_DOC_TYPE, normalizeAiCredits } from "@/lib/konto/ai-credits"
import { normalizeCustomerEmail } from "@/lib/admin/customers"

type CosmosDoc<T> = T & { id: string; docType?: string }

function mapCosmosAccount(doc: CosmosDoc<CustomerAccount>): CustomerAccount {
  return {
    id: doc.id,
    docType: CUSTOMER_DOC_TYPE,
    email: doc.email,
    passwordHash: doc.passwordHash,
    firstName: doc.firstName,
    lastName: doc.lastName,
    street: doc.street ?? "",
    zip: doc.zip ?? "",
    city: doc.city ?? "",
    phone: doc.phone ?? "",
    kundennummer: doc.kundennummer,
    aiCredits: normalizeAiCredits(doc.aiCredits),
    aiCreditGrants: doc.aiCreditGrants ?? {},
    passwordResetTokenHash: doc.passwordResetTokenHash ?? null,
    passwordResetExpiresAt: doc.passwordResetExpiresAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

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
    return mapCosmosAccount(doc)
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetAccountByEmail:${id}`, error)
    throw error
  }
}

export async function cosmosListAccounts(): Promise<CustomerAccount[]> {
  const container = await getCustomerAccountsContainer()
  const { resources } = await container.items
    .query<CosmosDoc<CustomerAccount>>("SELECT * FROM c")
    .fetchAll()
  return resources.map(mapCosmosAccount)
}

export async function cosmosUpsertAccount(
  account: CustomerAccount
): Promise<CustomerAccount> {
  const container = await getCustomerAccountsContainer()
  const doc = {
    ...account,
    id: account.id,
    docType: CUSTOMER_DOC_TYPE,
    aiCredits: normalizeAiCredits(account.aiCredits),
  }
  await container.items.upsert(doc)
  return account
}
