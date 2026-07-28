/**
 * Setzt das Passwort für Admin- und/oder Tester-Konten zurueck (Cosmos DB oder lokale JSON).
 *
 * Usage:
 *   node scripts/reset-staff-password.mjs
 *   node scripts/reset-staff-password.mjs admin
 *   node scripts/reset-staff-password.mjs admin "NeuesPasswort123!"
 *   node scripts/reset-staff-password.mjs admin --clear-2fa
 *
 * Passwort-Reihenfolge: CLI-Argument > ADMIN_PASSWORD > NEXT_PUBLIC_ADMIN_PASSWORD (bzw. Tester-Env)
 * Laedt Variablen aus .env.local falls vorhanden.
 */

import { randomBytes, scryptSync } from "crypto"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { CosmosClient } from "@azure/cosmos"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

const KEY_LEN = 64
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }

function loadEnvLocal() {
  const envPath = join(root, ".env.local")
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocal()

const ROLES = ["admin", "tester"]
const args = process.argv.slice(2)
const clear2fa = args.includes("--clear-2fa")
const positional = args.filter((a) => !a.startsWith("--"))
const targetArg = positional[0]?.toLowerCase()
const passwordArg = positional[1]
const targets =
  targetArg && ROLES.includes(targetArg) ? [targetArg] : ["admin"]

function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS)
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`
}

function getPasswordForRole(role) {
  if (passwordArg) return passwordArg

  if (role === "admin") {
    return (
      process.env.ADMIN_PASSWORD?.trim() ||
      process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() ||
      ""
    )
  }

  return (
    process.env.TESTER_PASSWORD?.trim() ||
    process.env.NEXT_PUBLIC_TESTER_PASSWORD?.trim() ||
    ""
  )
}

function isCosmosConfigured() {
  const endpoint = process.env.COSMOSDB_ENDPOINT?.trim() ?? ""
  const key = process.env.COSMOSDB_KEY?.trim() ?? ""
  if (!endpoint || !key) return false
  if (endpoint.includes("placeholder") || key.includes("placeholder")) {
    return false
  }
  return true
}

async function getStaffContainer() {
  const databaseId = process.env.COSMOSDB_DATABASE?.trim() || "dripforge"
  const client = new CosmosClient({
    endpoint: process.env.COSMOSDB_ENDPOINT,
    key: process.env.COSMOSDB_KEY,
  })
  const container = client.database(databaseId).container("settings")
  await container.read()
  return container
}

function staffCosmosId(role) {
  return `staff-${role}`
}

async function resetInCosmos(role, password) {
  const container = await getStaffContainer()
  const now = new Date().toISOString()
  const docId = staffCosmosId(role)

  let resource = null
  try {
    const result = await container.item(docId, docId).read()
    resource = result.resource
  } catch (err) {
    if (err.code !== 404 && err.statusCode !== 404) throw err
  }

  const updated = resource
    ? {
        ...resource,
        passwordHash: hashPassword(password),
        updatedAt: now,
      }
    : {
        id: docId,
        docType: "staff-account",
        role,
        passwordHash: hashPassword(password),
        totpSecretEncrypted: null,
        totpEnabled: false,
        createdAt: now,
        updatedAt: now,
      }

  if (clear2fa) {
    updated.totpSecretEncrypted = null
    updated.totpEnabled = false
  }

  await container.items.upsert(updated)
  return true
}

function resetInLocalFile(role, password) {
  const dataDir = join(root, "data", "admin")
  const filePath = join(dataDir, "staff-accounts.json")
  const now = new Date().toISOString()
  let accounts = []

  if (existsSync(filePath)) {
    accounts = JSON.parse(readFileSync(filePath, "utf8"))
  }

  const index = accounts.findIndex((a) => a.id === role || a.role === role)
  const base =
    index >= 0
      ? accounts[index]
      : {
          id: role,
          role,
          totpSecretEncrypted: null,
          totpEnabled: false,
          createdAt: now,
        }

  const next = {
    ...base,
    passwordHash: hashPassword(password),
    updatedAt: now,
  }

  if (clear2fa) {
    next.totpSecretEncrypted = null
    next.totpEnabled = false
  }

  if (index >= 0) accounts[index] = next
  else accounts.push(next)

  mkdirSync(dataDir, { recursive: true })
  writeFileSync(filePath, JSON.stringify(accounts, null, 2), "utf8")
  return true
}

async function main() {
  for (const role of targets) {
    const password = getPasswordForRole(role)
    if (!password || password.length < 8) {
      console.error(
        `[${role}] Kein Passwort. Setze ADMIN_PASSWORD in .env.local oder uebergib es als Argument.`
      )
      process.exit(1)
    }

    console.log(`DripForge: Passwort zurücksetzen für "${role}"...`)

    let ok = false
    if (isCosmosConfigured()) {
      try {
        await resetInCosmos(role, password)
        console.log(`[cosmos] ${role}: passwordHash aktualisiert`)
        ok = true
      } catch (err) {
        console.error(`[cosmos] ${role} fehlgeschlagen:`, err.message)
      }
    } else {
      console.log("[cosmos] Nicht konfiguriert — übersprungen.")
    }

    const localOk = resetInLocalFile(role, password)
    if (localOk) console.log(`[local] ${role}: passwordHash aktualisiert`)
    ok = ok || localOk

    if (!ok) {
      console.warn(`${role}: nichts geändert.`)
      process.exit(1)
    }

    if (clear2fa) {
      console.log(`[${role}] 2FA deaktiviert — beim nächsten Login QR-Code neu einrichten.`)
    }
  }

  console.log("\nFertig. Login unter /dripforgehq mit dem gesetzten Passwort.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
