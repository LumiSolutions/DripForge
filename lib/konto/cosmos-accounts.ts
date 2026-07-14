import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  CUSTOMER_ACCOUNT_DOC_TYPE,
  customerAccountsQuerySql,
  resolveCustomerAccountsContainer,
  toCustomerAccountCosmosDoc,
} from "@/lib/cosmos/customer-accounts-container"
import type { CustomerAccount } from "@/lib/konto/account-types"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { normalizeLoyaltyPoints } from "@/lib/konto/loyalty-points-config"

type CosmosDoc<T> = T & { id: string; docType?: string }

function mapCosmosAccount(doc: CosmosDoc<CustomerAccount>): CustomerAccount {
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
    status: doc.status,
    deletedAt: doc.deletedAt ?? null,
    aiCredits: normalizeLoyaltyPoints(doc.aiCredits),
    aiCreditGrants: doc.aiCreditGrants ?? {},
    loyaltyPoints: normalizeLoyaltyPoints(doc.loyaltyPoints),
    loyaltyPointGrants: doc.loyaltyPointGrants ?? {},
    loyaltyPointTransactions: doc.loyaltyPointTransactions ?? [],
    passwordResetTokenHash: doc.passwordResetTokenHash ?? null,
    passwordResetExpiresAt: doc.passwordResetExpiresAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function isAccountDoc(doc: CosmosDoc<CustomerAccount> | null | undefined): boolean {
  if (!doc?.id) return false
  if (doc.docType != null && doc.docType !== CUSTOMER_ACCOUNT_DOC_TYPE) return false
  return Boolean(doc.email || doc.passwordHash)
}

export async function cosmosGetAccountByEmail(
  email: string
): Promise<CustomerAccount | null> {
  const id = normalizeCustomerEmail(email)
  if (!id) return null

  const { container, mode } = await resolveCustomerAccountsContainer()
  try {
    const { resource: doc } = await container
      .item(id, id)
      .read<CosmosDoc<CustomerAccount>>()
    if (!doc || !isAccountDoc(doc)) return null
    if (mode === "shared" && doc.docType !== CUSTOMER_ACCOUNT_DOC_TYPE) return null
    return mapCosmosAccount(doc)
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetAccountByEmail:${id}`, error)
    throw error
  }
}

export async function cosmosListAccounts(): Promise<CustomerAccount[]> {
  const { container, mode } = await resolveCustomerAccountsContainer()
  const { resources } = await container.items
    .query<CosmosDoc<CustomerAccount>>(customerAccountsQuerySql(mode))
    .fetchAll()
  return resources.filter(isAccountDoc).map(mapCosmosAccount)
}

export async function cosmosUpsertAccount(
  account: CustomerAccount
): Promise<CustomerAccount> {
  const { container, mode } = await resolveCustomerAccountsContainer()
  await container.items.upsert(
    toCustomerAccountCosmosDoc({ ...account, id: account.id }, mode)
  )
  return account
}

export async function cosmosDeleteAccount(id: string): Promise<boolean> {
  const accountId = normalizeCustomerEmail(id)
  if (!accountId) return false

  const { container } = await resolveCustomerAccountsContainer()
  try {
    await container.item(accountId, accountId).delete()
    return true
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return false
    logCosmosError(`cosmosDeleteAccount:${accountId}`, error)
    throw error
  }
}
