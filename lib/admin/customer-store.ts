import { promises as fs } from "fs"
import path from "path"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import type { StoredCustomer } from "@/lib/admin/types"
import {
  cosmosGetCustomers,
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
      const index = customers.findIndex((c) => c.kundennummer === next.kundennummer)
      if (index >= 0) customers[index] = next
      else customers.push(next)
      await writeCustomersFile(customers)
      return next
    }
  )

  return next
}
