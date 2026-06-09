import { promises as fs } from "fs"
import path from "path"
import { hashPassword, verifyPassword } from "@/lib/konto/password"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import { getStaffPasswordFromEnv } from "@/lib/admin/staff-passwords"
import {
  cosmosGetStaffById,
  cosmosUpsertStaff,
} from "@/lib/admin/staff-cosmos"
import type { StaffAccount, StaffRole } from "@/lib/admin/staff-types"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const STAFF_FILE = "staff-accounts.json"

async function readStaffFile(): Promise<StaffAccount[]> {
  const filePath = path.join(DATA_DIR, STAFF_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    return JSON.parse(raw) as StaffAccount[]
  } catch {
    return []
  }
}

async function writeStaffFile(accounts: StaffAccount[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const filePath = path.join(DATA_DIR, STAFF_FILE)
  await fs.writeFile(filePath, JSON.stringify(accounts, null, 2), "utf-8")
}

export async function getStaffById(id: StaffRole): Promise<StaffAccount | null> {
  return withCosmosFallback(
    "getStaffById",
    () => cosmosGetStaffById(id),
    async () => {
      const accounts = await readStaffFile()
      return accounts.find((a) => a.id === id) ?? null
    }
  )
}

export async function saveStaff(account: StaffAccount): Promise<StaffAccount> {
  const next: StaffAccount = {
    ...account,
    id: account.role,
    role: account.role,
    updatedAt: new Date().toISOString(),
  }

  await withCosmosFallback(
    "saveStaff",
    async () => {
      await cosmosUpsertStaff(next)
    },
    async () => {
      const accounts = await readStaffFile()
      const index = accounts.findIndex((a) => a.id === next.id)
      if (index >= 0) accounts[index] = next
      else accounts.push(next)
      await writeStaffFile(accounts)
    }
  )

  return next
}

export async function ensureStaffAccount(role: StaffRole): Promise<StaffAccount> {
  const existing = await getStaffById(role)
  if (existing) return existing

  const now = new Date().toISOString()
  const account: StaffAccount = {
    id: role,
    role,
    passwordHash: hashPassword(getStaffPasswordFromEnv(role)),
    totpSecretEncrypted: null,
    totpEnabled: false,
    createdAt: now,
    updatedAt: now,
  }

  return saveStaff(account)
}

export async function verifyStaffPassword(
  role: StaffRole,
  password: string
): Promise<StaffAccount | null> {
  const account = await ensureStaffAccount(role)
  if (!verifyPassword(password, account.passwordHash)) {
    const envPassword = getStaffPasswordFromEnv(role)
    if (password !== envPassword) return null

    const updated = await saveStaff({
      ...account,
      passwordHash: hashPassword(envPassword),
    })
    return updated
  }
  return account
}
