import type { SqlQuerySpec } from "@azure/cosmos"
import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  CHART_ACCOUNT_DOC_TYPE,
  chartAccountCosmosId,
  normalizeAccount,
  normalizeAccountNumber,
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
  const querySpec: SqlQuerySpec = {
    query: "SELECT * FROM c WHERE c.docType = @docType ORDER BY c.number",
    parameters: [{ name: "@docType", value: CHART_ACCOUNT_DOC_TYPE }],
  }
  const { resources } = await container.items
    .query<AccountCosmosDoc>(querySpec)
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

export async function cosmosCreateChartAccount(input: {
  number: string
  name: string
  group?: string | null
  type: Account["type"]
  systemCode?: string
  taxType?: string
}): Promise<Account> {
  const number = normalizeAccountNumber(input.number)
  if (!number) {
    throw new Error("Kontonummer fehlt.")
  }
  if (!String(input.name ?? "").trim()) {
    throw new Error("Kontoname fehlt.")
  }

  const existing = await cosmosGetChartAccountByNumber(number)
  if (existing) {
    throw new Error(`Konto ${number} existiert bereits.`)
  }

  const now = new Date().toISOString()
  const account = normalizeAccount({
    number,
    name: input.name,
    group: input.group ?? null,
    type: input.type,
    systemCode: input.systemCode,
    taxType: input.taxType,
    isEditable: true,
    createdAt: now,
    updatedAt: now,
  })

  return cosmosUpsertChartAccount(account)
}
