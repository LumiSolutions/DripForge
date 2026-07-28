/**
 * Importiert den Schweizer KMU-Kontenplan aus chart-of-accounts.xlsx in Cosmos DB.
 *
 * Voraussetzungen in .env.local:
 *   COSMOSDB_ENDPOINT, COSMOSDB_KEY
 *
 * Aufruf:
 *   node scripts/import-accounts.mjs
 *   node scripts/import-accounts.mjs "C:/Users/schul/Downloads/chart-of-accounts.xlsx"
 */

import { readFileSync, existsSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { CosmosClient } from "@azure/cosmos"
import XLSX from "xlsx"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const DEFAULT_XLSX = join(
  process.env.USERPROFILE ?? process.env.HOME ?? "",
  "Downloads",
  "chart-of-accounts.xlsx"
)

function loadEnvLocal() {
  const envPath = join(ROOT, ".env.local")
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

function trimOptional(value) {
  if (value == null) return undefined
  const trimmed = String(value).trim()
  return trimmed || undefined
}

function normalizeAccountRow(row) {
  const number = String(row["Nummer*"] ?? row.Nummer ?? "").trim()
  const name = String(row["Name*"] ?? row.Name ?? "").trim()
  const groupRaw = row["Gruppe*"] ?? row.Gruppe
  const group =
    groupRaw == null || String(groupRaw).trim() === ""
      ? null
      : String(groupRaw).trim()
  const type = String(row["Kontoart*"] ?? row.Kontoart ?? "").trim()
  const systemCode = trimOptional(row.Systemkonto)
  const taxType = trimOptional(row.Steuertyp)

  return { number, name, group, type, systemCode, taxType }
}

loadEnvLocal()

const xlsxPath = resolve(process.argv[2] || DEFAULT_XLSX)
const endpoint = process.env.COSMOSDB_ENDPOINT?.trim()
const key = process.env.COSMOSDB_KEY?.trim()
const databaseId = process.env.COSMOSDB_DATABASE?.trim() || "dripforge"

if (!endpoint || !key) {
  console.error("COSMOSDB_ENDPOINT und COSMOSDB_KEY muessen gesetzt sein (.env.local).")
  process.exit(1)
}

if (!existsSync(xlsxPath)) {
  console.error(`Excel-Datei nicht gefunden: ${xlsxPath}`)
  process.exit(1)
}

const workbook = XLSX.readFile(xlsxPath)
const sheetName = workbook.SheetNames[0]
if (!sheetName) {
  console.error("Keine Arbeitsblaetter in der Excel-Datei gefunden.")
  process.exit(1)
}

const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])
if (!rows.length) {
  console.log("Keine Kontenzeilen in der Excel-Datei — nichts zu importieren.")
  process.exit(0)
}

const CHART_ACCOUNT_DOC_TYPE = "chart-account"

function chartAccountCosmosId(number) {
  return `${CHART_ACCOUNT_DOC_TYPE}:${number}`
}

const client = new CosmosClient({ endpoint, key })
const { database } = await client.databases.createIfNotExists({ id: databaseId })
const container = database.container("settings")
await container.read()
let imported = 0
let updated = 0
let skipped = 0

const now = new Date().toISOString()

for (const row of rows) {
  const parsed = normalizeAccountRow(row)
  if (!parsed.number || !parsed.name || !parsed.type) {
    console.warn("Überspringe unvollständige Zeile:", row)
    skipped += 1
    continue
  }

  let existing = null
  const cosmosId = chartAccountCosmosId(parsed.number)
  try {
    const { resource } = await container.item(cosmosId, cosmosId).read()
    existing = resource?.docType === CHART_ACCOUNT_DOC_TYPE ? resource : null
  } catch (error) {
    if (error?.code !== 404) throw error
  }

  const account = {
    id: cosmosId,
    docType: CHART_ACCOUNT_DOC_TYPE,
    number: parsed.number,
    name: parsed.name,
    group: parsed.group,
    type: parsed.type,
    ...(parsed.systemCode ? { systemCode: parsed.systemCode } : {}),
    ...(parsed.taxType ? { taxType: parsed.taxType } : {}),
    isEditable: existing?.isEditable ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await container.items.upsert(account)
  if (existing) {
    updated += 1
  } else {
    imported += 1
  }
}

const { resources: all } = await container.items
  .query({
    query: "SELECT VALUE COUNT(1) FROM c WHERE c.docType = @docType",
    parameters: [{ name: "@docType", value: CHART_ACCOUNT_DOC_TYPE }],
  })
  .fetchAll()
const totalInDb = all[0] ?? imported + updated

console.log("")
console.log("Import abgeschlossen.")
console.log(`  Quelle:        ${xlsxPath}`)
console.log(`  Arbeitsblatt:  ${sheetName}`)
console.log(`  Zeilen gelesen: ${rows.length}`)
console.log(`  Neu importiert: ${imported}`)
console.log(`  Aktualisiert:   ${updated}`)
console.log(`  Übersprungen:  ${skipped}`)
console.log(`  Konten in DB:   ${totalInDb}`)
