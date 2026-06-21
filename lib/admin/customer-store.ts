import { promises as fs } from "fs"
import path from "path"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import type { StoredCustomer } from "@/lib/admin/types"
import {
  cosmosGetCustomers,
  cosmosReplaceCustomerRecord,
  cosmosSaveCustomer,
} from "@/lib/admin/cosmos-store"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const CUSTOMERS_FILE = "customers.json"

async function readCustomersFile(): Promise<StoredCustomer[]> {
  const filePath = path.join(DATA_DIR, CUSTOMERS_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    return JSON.parse(raw) as StoredCustomer[]
  } catch {
    return []
  }
}

async function writeCustomersFile(customers: StoredCustomer[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const filePath = path.join(DATA_DIR, CUSTOMERS_FILE)
  await fs.writeFile(filePath, JSON.stringify(customers, null, 2), "utf-8")
}

/** CRM-Kunden ohne Reconciliation (fuer Nummernvergabe / Sync). */
export async function getCustomersSnapshot(): Promise<StoredCustomer[]> {
  return withCosmosFallback(
    "getCustomersSnapshot",
    cosmosGetCustomers,
    readCustomersFile
  )
}

export async function saveCustomer(customer: StoredCustomer): Promise<StoredCustomer> {
  const next: StoredCustomer = {
    ...customer,
    updatedAt: new Date().toISOString(),
  }

  await withCosmosFallback(
    "saveCustomer",
    () => cosmosSaveCustomer(next),
    async () => {
      const customers = await readCustomersFile()
      const duplicate = customers.find(
        (entry) =>
          entry.kundennummer === next.kundennummer &&
          normalizeCustomerEmail(entry.email) !== normalizeCustomerEmail(next.email)
      )
      if (duplicate) {
        throw new Error(`Kundennummer ${next.kundennummer} ist bereits vergeben.`)
      }
      const index = customers.findIndex((c) => c.kundennummer === next.kundennummer)
      if (index >= 0) customers[index] = next
      else customers.push(next)
      await writeCustomersFile(customers)
      return next
    }
  )

  return next
}

/** Ersetzt CRM-Stammdaten inkl. Kundennummern-Wechsel (Legacy → YY-#####). */
export async function replaceCustomerForEmail(
  email: string,
  customer: StoredCustomer,
  previousKundennummer?: string
): Promise<StoredCustomer> {
  const normalizedEmail = normalizeCustomerEmail(email)
  const next: StoredCustomer = {
    ...customer,
    email: normalizedEmail,
    updatedAt: new Date().toISOString(),
  }

  await withCosmosFallback(
    "replaceCustomerForEmail",
    () => cosmosReplaceCustomerRecord(next, previousKundennummer),
    async () => {
      const customers = await readCustomersFile()
      const duplicate = customers.find(
        (entry) =>
          entry.kundennummer === next.kundennummer &&
          normalizeCustomerEmail(entry.email) !== normalizedEmail
      )
      if (duplicate) {
        throw new Error(`Kundennummer ${next.kundennummer} ist bereits vergeben.`)
      }

      const withoutPrevious = customers.filter((entry) => {
        if (normalizeCustomerEmail(entry.email) === normalizedEmail) return false
        if (
          previousKundennummer &&
          entry.kundennummer === previousKundennummer
        ) {
          return false
        }
        return true
      })

      const index = withoutPrevious.findIndex(
        (entry) => entry.kundennummer === next.kundennummer
      )
      if (index >= 0) withoutPrevious[index] = next
      else withoutPrevious.push(next)

      await writeCustomersFile(withoutPrevious)
      return next
    }
  )

  return next
}
