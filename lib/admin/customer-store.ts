import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import type { StoredCustomer } from "@/lib/admin/types"
import {
  cosmosGetCustomers,
  cosmosReplaceCustomerRecord,
  cosmosSaveCustomer,
  cosmosDeleteCustomer,
} from "@/lib/admin/cosmos-store"
import {
  deleteCustomerFromFile,
  getCustomersFromFile,
  replaceCustomerInFile,
  saveCustomerToFile,
} from "@/lib/admin/customers-file"

/**
 * CRM-Kunden ohne Reconciliation (für Nummernvergabe / Sync).
 * Ohne Cosmos: lokaler JSON-Fallback (`data/admin/customers.json`).
 */
export async function getCustomersSnapshot(): Promise<StoredCustomer[]> {
  return withCosmosFallback(
    "getCustomersSnapshot",
    cosmosGetCustomers,
    getCustomersFromFile
  )
}

export async function saveCustomer(customer: StoredCustomer): Promise<StoredCustomer> {
  const next: StoredCustomer = {
    ...customer,
    updatedAt: new Date().toISOString(),
  }

  return withCosmosFallback(
    "saveCustomer",
    () => cosmosSaveCustomer(next),
    () => saveCustomerToFile(next)
  )
}

/** Ersetzt CRM-Stammdaten inkl. Kundennummern-Wechsel (Legacy → YY-#####). */
export async function replaceCustomerForEmail(
  email: string,
  customer: StoredCustomer,
  previousKundennummer?: string
): Promise<StoredCustomer> {
  const next: StoredCustomer = {
    ...customer,
    email: normalizeCustomerEmail(email),
    updatedAt: new Date().toISOString(),
  }

  return withCosmosFallback(
    "replaceCustomerForEmail",
    () => cosmosReplaceCustomerRecord(next, previousKundennummer),
    () => replaceCustomerInFile(next, previousKundennummer)
  )
}

export async function deleteCustomerByNumber(kundennummer: string): Promise<boolean> {
  const trimmed = kundennummer.trim()
  if (!trimmed) return false

  return withCosmosFallback(
    "deleteCustomerByNumber",
    () => cosmosDeleteCustomer(trimmed),
    () => deleteCustomerFromFile(trimmed)
  )
}
