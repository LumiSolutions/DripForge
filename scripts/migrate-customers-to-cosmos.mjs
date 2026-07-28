/**
 * Einmalige Migration: data/admin/customers.json → Cosmos DB Container "customers".
 *
 * Voraussetzungen in .env.local:
 *   COSMOSDB_ENDPOINT, COSMOSDB_KEY
 *
 * Aufruf: node scripts/migrate-customers-to-cosmos.mjs
 */

import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { CosmosClient } from "@azure/cosmos"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const CUSTOMERS_FILE = path.join(ROOT, "data", "admin", "customers.json")

const endpoint = process.env.COSMOSDB_ENDPOINT?.trim()
const key = process.env.COSMOSDB_KEY?.trim()
const databaseId = process.env.COSMOSDB_DATABASE?.trim() || "dripforge"

if (!endpoint || !key) {
  console.error("COSMOSDB_ENDPOINT und COSMOSDB_KEY muessen gesetzt sein.")
  process.exit(1)
}

let customers
try {
  const raw = await readFile(CUSTOMERS_FILE, "utf-8")
  customers = JSON.parse(raw)
} catch (error) {
  console.error(`Konnte ${CUSTOMERS_FILE} nicht lesen:`, error.message)
  process.exit(1)
}

if (!Array.isArray(customers) || customers.length === 0) {
  console.log("Keine Kunden in der lokalen JSON-Datei — nichts zu migrieren.")
  process.exit(0)
}

const client = new CosmosClient({ endpoint, key })
const { database } = await client.databases.createIfNotExists({ id: databaseId })
const { container } = await database.containers.createIfNotExists({
  id: "customers",
  partitionKey: { paths: ["/kundennummer"] },
})

let migrated = 0
for (const customer of customers) {
  const kundennummer = customer?.kundennummer?.trim()
  if (!kundennummer) {
    console.warn("Überspringe Eintrag ohne kundennummer:", customer)
    continue
  }
  await container.items.upsert({ ...customer, id: kundennummer })
  migrated += 1
  console.log(`Migriert: ${kundennummer} (${customer.email ?? "—"})`)
}

console.log(`Fertig: ${migrated} Kunde(n) nach Cosmos DB uebertragen.`)
