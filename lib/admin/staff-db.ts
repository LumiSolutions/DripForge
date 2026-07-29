import { promises as fs } from "fs"
import path from "path"
import { isCosmosConfigured } from "@/lib/cosmos/client"
import { hashPassword, verifyPassword } from "@/lib/konto/password"
import {
  withCosmosFallback,
  withCosmosRequired,
} from "@/lib/admin/storage-bridge"
import {
  getStaffPasswordFromEnv,
  hasStaffPasswordInEnv,
} from "@/lib/admin/staff-passwords"
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
  if (isCosmosConfigured()) {
    return withCosmosRequired("getStaffById", () => cosmosGetStaffById(id))
  }

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

  if (isCosmosConfigured()) {
    await withCosmosRequired("saveStaff", async () => {
      await cosmosUpsertStaff(next)
    })
    return next
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

  const envPassword = getStaffPasswordFromEnv(role)
  if (!envPassword) {
    throw new Error(
      `Kein ${role}-Passwort in der Umgebung gesetzt. Setze ADMIN_PASSWORD bzw. TESTER_PASSWORD.`
    )
  }

  const now = new Date().toISOString()
  const account: StaffAccount = {
    id: role,
    role,
    passwordHash: hashPassword(envPassword),
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
  if (!password) return null

  const account = await getStaffById(role)
  if (!account) {
    if (!hasStaffPasswordInEnv(role)) return null
    // Erstes Setup: Account aus ENV anlegen, dann erneut prüfen
    const created = await ensureStaffAccount(role)
    if (!verifyPassword(password, created.passwordHash)) return null
    return created
  }

  if (!verifyPassword(password, account.passwordHash)) {
    const envPassword = getStaffPasswordFromEnv(role)
    // ENV-Sync nur mit nicht-leerem Passwort (kein Empty-String-Login)
    if (!envPassword || password !== envPassword) return null

    const updated = await saveStaff({
      ...account,
      passwordHash: hashPassword(envPassword),
    })
    return updated
  }
  return account
}
