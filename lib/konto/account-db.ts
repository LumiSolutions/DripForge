import { promises as fs } from "fs"
import path from "path"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import {
  cosmosGetAccountByEmail,
  cosmosUpsertAccount,
} from "@/lib/konto/cosmos-accounts"
import type { CustomerAccount } from "@/lib/konto/account-types"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const ACCOUNTS_FILE = "customer-accounts.json"

async function readAccountsFile(): Promise<CustomerAccount[]> {
  const filePath = path.join(DATA_DIR, ACCOUNTS_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    return JSON.parse(raw) as CustomerAccount[]
  } catch {
    return []
  }
}

async function writeAccountsFile(accounts: CustomerAccount[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const filePath = path.join(DATA_DIR, ACCOUNTS_FILE)
  await fs.writeFile(filePath, JSON.stringify(accounts, null, 2), "utf-8")
}

export async function getAccountByEmail(
  email: string
): Promise<CustomerAccount | null> {
  const normalized = normalizeCustomerEmail(email)
  if (!normalized) return null

  return withCosmosFallback(
    "getAccountByEmail",
    () => cosmosGetAccountByEmail(normalized),
    async () => {
      const accounts = await readAccountsFile()
      return accounts.find((a) => a.email === normalized) ?? null
    }
  )
}

export async function saveAccount(account: CustomerAccount): Promise<CustomerAccount> {
  const next: CustomerAccount = {
    ...account,
    id: normalizeCustomerEmail(account.email),
    email: normalizeCustomerEmail(account.email),
    updatedAt: new Date().toISOString(),
  }

  await withCosmosFallback(
    "saveAccount",
    async () => {
      await cosmosUpsertAccount(next)
    },
    async () => {
      const accounts = await readAccountsFile()
      const index = accounts.findIndex((a) => a.id === next.id)
      if (index >= 0) accounts[index] = next
      else accounts.push(next)
      await writeAccountsFile(accounts)
    }
  )
  return next
}

export function toPublicAccount(account: CustomerAccount) {
  return {
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    kundennummer: account.kundennummer,
    createdAt: account.createdAt,
  }
}
