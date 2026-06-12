import { promises as fs } from "fs"
import path from "path"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import {
  cosmosGetAccountByEmail,
  cosmosListAccounts,
  cosmosUpsertAccount,
} from "@/lib/konto/cosmos-accounts"
import type { CustomerAccount } from "@/lib/konto/account-types"
import { CUSTOMER_DOC_TYPE, normalizeAiCredits } from "@/lib/konto/ai-credits"
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

export async function listAllAccounts(): Promise<CustomerAccount[]> {
  return withCosmosFallback(
    "listAllAccounts",
    () => cosmosListAccounts(),
    readAccountsFile
  )
}

function normalizeAccount(account: CustomerAccount): CustomerAccount {
  return {
    ...account,
    docType: account.docType ?? CUSTOMER_DOC_TYPE,
    aiCredits: normalizeAiCredits(account.aiCredits),
    aiCreditGrants: account.aiCreditGrants ?? {},
  }
}

export async function getAccountByEmail(
  email: string
): Promise<CustomerAccount | null> {
  const normalized = normalizeCustomerEmail(email)
  if (!normalized) return null

  const account = await withCosmosFallback(
    "getAccountByEmail",
    () => cosmosGetAccountByEmail(normalized),
    async () => {
      const accounts = await readAccountsFile()
      return accounts.find((a) => a.email === normalized) ?? null
    }
  )
  return account ? normalizeAccount(account) : null
}

export async function saveAccount(account: CustomerAccount): Promise<CustomerAccount> {
  const next: CustomerAccount = {
    ...account,
    id: normalizeCustomerEmail(account.email),
    email: normalizeCustomerEmail(account.email),
    docType: account.docType ?? CUSTOMER_DOC_TYPE,
    aiCredits: normalizeAiCredits(account.aiCredits),
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
    street: account.street ?? "",
    zip: account.zip ?? "",
    city: account.city ?? "",
    phone: account.phone ?? "",
    kundennummer: account.kundennummer,
    aiCredits: normalizeAiCredits(account.aiCredits),
    createdAt: account.createdAt,
  }
}
