import type { Container } from "@azure/cosmos"
import { ensureDatabase, getSettingsContainer } from "@/lib/cosmos/client"

export const CUSTOMER_DOC_TYPE = "customer"

export type CustomersStorageMode = "dedicated" | "shared"

type State = {
  container: Container
  mode: CustomersStorageMode
}

let resolved: State | null = null

/**
 * CRM-Kunden: dedizierter Container wenn vorhanden, sonst settings (docType=customer).
 */
export async function resolveCustomersContainer(): Promise<State> {
  if (resolved) return resolved

  const database = await ensureDatabase()

  try {
    const dedicated = database.container("customers")
    await dedicated.read()
    resolved = { container: dedicated, mode: "dedicated" }
    console.info("Cosmos DB: Container 'customers' aktiv.")
    return resolved
  } catch {
    const shared = await getSettingsContainer()
    resolved = { container: shared, mode: "shared" }
    console.warn(
      "Cosmos DB: Container 'customers' nicht verfügbar — CRM-Kunden werden im Container 'settings' (docType=customer) gespeichert."
    )
    return resolved
  }
}

export function customersQuerySql(mode: CustomersStorageMode): string {
  if (mode === "shared") {
    return `SELECT * FROM c WHERE c.docType = '${CUSTOMER_DOC_TYPE}'`
  }
  return `SELECT * FROM c WHERE (NOT IS_DEFINED(c.docType) OR c.docType = '${CUSTOMER_DOC_TYPE}')`
}

export function toCustomerCosmosDoc<T extends { id: string }>(
  customer: T,
  mode: CustomersStorageMode
): T & { docType?: string } {
  if (mode === "shared") {
    return { ...customer, docType: CUSTOMER_DOC_TYPE }
  }
  return customer
}

export function resetCustomersContainerCache(): void {
  resolved = null
}
