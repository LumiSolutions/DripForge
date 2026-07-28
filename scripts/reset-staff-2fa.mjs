/**
 * Setzt 2FA-Secrets für Admin- und Tester-Konten zurueck (Cosmos DB oder lokale JSON).
 *
 * Usage:
 *   node scripts/reset-staff-2fa.mjs
 *   node scripts/reset-staff-2fa.mjs admin
 *   node scripts/reset-staff-2fa.mjs tester
 *
 * Laedt Variablen aus .env.local falls vorhanden.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { CosmosClient } from "@azure/cosmos"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

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
const targetArg = process.argv[2]?.toLowerCase()
const targets =
  targetArg && ROLES.includes(targetArg) ? [targetArg] : ROLES

function isCosmosConfigured() {
  const endpoint = process.env.COSMOSDB_ENDPOINT?.trim() ?? ""
  const key = process.env.COSMOSDB_KEY?.trim() ?? ""
  if (!endpoint || !key) return false
  if (endpoint.includes("placeholder") || key.includes("placeholder")) {
    return false
  }
  return true
}

async function clearInCosmos(role) {
  const databaseId = process.env.COSMOSDB_DATABASE?.trim() || "dripforge"

  const client = new CosmosClient({
    endpoint: process.env.COSMOSDB_ENDPOINT,
    key: process.env.COSMOSDB_KEY,
  })

  const container = client.database(databaseId).container("settings")
  const docId = `staff-${role}`
  let resource
  try {
    const result = await container.item(docId, docId).read()
    resource = result.resource
  } catch (err) {
    if (err.code === 404 || err.statusCode === 404) {
      console.warn(`[cosmos] Kein Dokument für "${role}" gefunden.`)
      return false
    }
    throw err
  }
  if (!resource) {
    console.warn(`[cosmos] Kein Dokument für "${role}" gefunden.`)
    return false
  }

  const updated = {
    ...resource,
    totpSecretEncrypted: null,
    totpEnabled: false,
    updatedAt: new Date().toISOString(),
  }
  await container.items.upsert(updated)
  return true
}

function clearInLocalFile(role) {
  const dataDir = join(root, "data", "admin")
  const filePath = join(dataDir, "staff-accounts.json")
  if (!existsSync(filePath)) {
    console.warn(`[local] ${filePath} nicht gefunden.`)
    return false
  }

  const accounts = JSON.parse(readFileSync(filePath, "utf8"))
  const index = accounts.findIndex((a) => a.id === role || a.role === role)
  if (index < 0) {
    console.warn(`[local] Kein Eintrag für "${role}".`)
    return false
  }

  accounts[index] = {
    ...accounts[index],
    totpSecretEncrypted: null,
    totpEnabled: false,
    updatedAt: new Date().toISOString(),
  }
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(filePath, JSON.stringify(accounts, null, 2), "utf8")
  return true
}

async function main() {
  console.log("DripForge: 2FA-Secrets zurücksetzen für:", targets.join(", "))

  for (const role of targets) {
    let ok = false
    if (isCosmosConfigured()) {
      try {
        ok = await clearInCosmos(role)
        if (ok) console.log(`[cosmos] ${role}: totpSecretEncrypted geloescht, totpEnabled=false`)
      } catch (err) {
        console.error(`[cosmos] ${role} fehlgeschlagen:`, err.message)
      }
    } else {
      console.log("[cosmos] Nicht konfiguriert — übersprungen.")
    }

    const localOk = clearInLocalFile(role)
    if (localOk) console.log(`[local] ${role}: aktualisiert`)
    ok = ok || localOk

    if (!ok) console.warn(`${role}: nichts geändert.`)
  }

  console.log("\nFertig. Beim nächsten Login erscheint die Ersteinrichtung mit QR-Code.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
