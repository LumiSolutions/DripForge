import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  CHART_ACCOUNT_DOC_TYPE,
  chartAccountCosmosId,
  normalizeAccount,
  toAccountCosmosDoc,
  type Account,
  type AccountCosmosDoc,
} from "@/lib/accounting/account-types"

function cosmosErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const err = error as { code?: number; statusCode?: number }
  return err.code ?? err.statusCode
}

function fromCosmosDoc(doc: AccountCosmosDoc): Account {
  return normalizeAccount(doc)
}

export async function cosmosGetChartAccounts(): Promise<Account[]> {
  const container = await getSettingsContainer()
  const { resources } = await container.items
    .query<AccountCosmosDoc>(
      "SELECT * FROM c WHERE c.docType = @docType ORDER BY c.number",
      { parameters: [{ name: "@docType", value: CHART_ACCOUNT_DOC_TYPE }] }
    )
    .fetchAll()

  return resources.map(fromCosmosDoc)
}

export async function cosmosGetChartAccountByNumber(
  number: string
): Promise<Account | null> {
  const normalized = number.trim()
  if (!normalized) return null

  const container = await getSettingsContainer()
  try {
    const cosmosId = chartAccountCosmosId(normalized)
    const { resource: doc } = await container
      .item(cosmosId, cosmosId)
      .read<AccountCosmosDoc>()
    if (!doc || doc.docType !== CHART_ACCOUNT_DOC_TYPE) return null
    return fromCosmosDoc(doc)
  } catch (error) {
    if (cosmosErrorCode(error) === 404) return null
    logCosmosError(`cosmosGetChartAccountByNumber:${number}`, error)
    throw error
  }
}

export async function cosmosUpsertChartAccount(account: Account): Promise<Account> {
  const container = await getSettingsContainer()
  const doc = toAccountCosmosDoc(account)
  await container.items.upsert(doc)
  return account
}
