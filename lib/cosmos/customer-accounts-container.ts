import type { Container } from "@azure/cosmos"
import { ensureDatabase, getSettingsContainer } from "@/lib/cosmos/client"

export const CUSTOMER_ACCOUNT_DOC_TYPE = "customer-account"

export type CustomerAccountsStorageMode = "dedicated" | "shared"

type State = {
  container: Container
  mode: CustomerAccountsStorageMode
}

let resolved: State | null = null

/**
 * Auth-Konten: dedizierter Container wenn vorhanden, sonst settings
 * (docType=customer-account) — nötig bei Cosmos-RU-Limits.
 */
export async function resolveCustomerAccountsContainer(): Promise<State> {
  if (resolved) return resolved

  const database = await ensureDatabase()

  try {
    const dedicated = database.container("customer-accounts")
    await dedicated.read()
    resolved = { container: dedicated, mode: "dedicated" }
    console.info("Cosmos DB: Container 'customer-accounts' aktiv.")
    return resolved
  } catch {
    const shared = await getSettingsContainer()
    resolved = { container: shared, mode: "shared" }
    console.warn(
      "Cosmos DB: Container 'customer-accounts' nicht verfügbar — Konten werden im Container 'settings' (docType=customer-account) gespeichert."
    )
    return resolved
  }
}

export function customerAccountsQuerySql(mode: CustomerAccountsStorageMode): string {
  if (mode === "shared") {
    return `SELECT * FROM c WHERE c.docType = '${CUSTOMER_ACCOUNT_DOC_TYPE}'`
  }
  return `SELECT * FROM c WHERE (NOT IS_DEFINED(c.docType) OR c.docType = '${CUSTOMER_ACCOUNT_DOC_TYPE}')`
}

export function toCustomerAccountCosmosDoc<T extends { id: string }>(
  account: T,
  mode: CustomerAccountsStorageMode
): T & { docType?: string } {
  if (mode === "shared") {
    return { ...account, docType: CUSTOMER_ACCOUNT_DOC_TYPE }
  }
  return account
}

export function resetCustomerAccountsContainerCache(): void {
  resolved = null
}
