import { normalizeCustomerEmail } from "@/lib/admin/customers"
import {
  withCosmosFallback,
  withCosmosRequired,
} from "@/lib/admin/storage-bridge"
import type { StoredCustomer } from "@/lib/admin/types"
import {
  cosmosGetCustomers,
  cosmosReplaceCustomerRecord,
  cosmosSaveCustomer,
  cosmosDeleteCustomer,
} from "@/lib/admin/cosmos-store"

/**
 * CRM-Kunden ohne Reconciliation (für Nummernvergabe / Sync).
 * Fallback [] — darf Checkout/Bestellung nie mit «Datenbank nicht erreichbar» abbrechen.
 */
export async function getCustomersSnapshot(): Promise<StoredCustomer[]> {
  return withCosmosFallback(
    "getCustomersSnapshot",
    cosmosGetCustomers,
    async () => []
  )
}

export async function saveCustomer(customer: StoredCustomer): Promise<StoredCustomer> {
  const next: StoredCustomer = {
    ...customer,
    updatedAt: new Date().toISOString(),
  }

  return withCosmosRequired("saveCustomer", () => cosmosSaveCustomer(next))
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

  return withCosmosRequired("replaceCustomerForEmail", () =>
    cosmosReplaceCustomerRecord(next, previousKundennummer)
  )
}

export async function deleteCustomerByNumber(kundennummer: string): Promise<boolean> {
  const trimmed = kundennummer.trim()
  if (!trimmed) return false

  return withCosmosRequired("deleteCustomerByNumber", () =>
    cosmosDeleteCustomer(trimmed)
  )
}
