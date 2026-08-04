import { promises as fs } from "fs"
import path from "path"
import type { StoredCustomer } from "@/lib/admin/types"
import { normalizeCustomerEmail } from "@/lib/admin/customers"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const CUSTOMERS_FILE = "customers.json"

async function readCustomersFile(): Promise<StoredCustomer[]> {
  const filePath = path.join(DATA_DIR, CUSTOMERS_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (row): row is StoredCustomer =>
        Boolean(row && typeof row === "object" && "kundennummer" in row)
    )
  } catch {
    return []
  }
}

async function writeCustomersFile(customers: StoredCustomer[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const filePath = path.join(DATA_DIR, CUSTOMERS_FILE)
  await fs.writeFile(filePath, JSON.stringify(customers, null, 2), "utf-8")
}

export async function getCustomersFromFile(): Promise<StoredCustomer[]> {
  return readCustomersFile()
}

export async function getCustomerByNumberFromFile(
  kundennummer: string
): Promise<StoredCustomer | null> {
  const id = kundennummer.trim()
  if (!id) return null
  const customers = await readCustomersFile()
  return customers.find((c) => c.kundennummer === id) ?? null
}

export async function saveCustomerToFile(
  customer: StoredCustomer
): Promise<StoredCustomer> {
  const customers = await readCustomersFile()
  const index = customers.findIndex(
    (c) => c.kundennummer === customer.kundennummer
  )
  if (index >= 0) customers[index] = customer
  else customers.push(customer)
  await writeCustomersFile(customers)
  return customer
}

export async function replaceCustomerInFile(
  customer: StoredCustomer,
  previousKundennummer?: string
): Promise<StoredCustomer> {
  const customers = await readCustomersFile()
  const email = normalizeCustomerEmail(customer.email)
  const filtered = customers.filter((c) => {
    if (previousKundennummer && c.kundennummer === previousKundennummer) {
      return false
    }
    if (c.kundennummer === customer.kundennummer) return false
    if (normalizeCustomerEmail(c.email) === email) return false
    return true
  })
  filtered.push(customer)
  await writeCustomersFile(filtered)
  return customer
}

export async function deleteCustomerFromFile(
  kundennummer: string
): Promise<boolean> {
  const id = kundennummer.trim()
  if (!id) return false
  const customers = await readCustomersFile()
  const next = customers.filter((c) => c.kundennummer !== id)
  if (next.length === customers.length) return false
  await writeCustomersFile(next)
  return true
}
