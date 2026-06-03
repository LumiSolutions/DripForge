import { CosmosClient, type Container, type Database } from "@azure/cosmos"

const DATABASE_ID = process.env.COSMOSDB_DATABASE?.trim() || "dripforge"

let client: CosmosClient | null = null
let databaseReady: Promise<Database> | null = null

export function isCosmosConfigured(): boolean {
  const endpoint = process.env.COSMOSDB_ENDPOINT?.trim() ?? ""
  const key = process.env.COSMOSDB_KEY?.trim() ?? ""
  if (!endpoint || !key) return false
  if (endpoint.includes("placeholder") || key.includes("placeholder")) return false
  return true
}

export function getCosmosClient(): CosmosClient {
  if (!isCosmosConfigured()) {
    throw new Error("Cosmos DB ist nicht konfiguriert (COSMOSDB_ENDPOINT / COSMOSDB_KEY).")
  }
  if (!client) {
    client = new CosmosClient({
      endpoint: process.env.COSMOSDB_ENDPOINT!,
      key: process.env.COSMOSDB_KEY!,
    })
  }
  return client
}

async function ensureDatabase(): Promise<Database> {
  if (!databaseReady) {
    databaseReady = (async () => {
      const cosmos = getCosmosClient()
      const { database } = await cosmos.databases.createIfNotExists({ id: DATABASE_ID })
      return database
    })()
  }
  return databaseReady
}

async function ensureContainer(
  containerId: string,
  partitionKey: string
): Promise<Container> {
  const database = await ensureDatabase()
  const { container } = await database.containers.createIfNotExists({
    id: containerId,
    partitionKey: { paths: [partitionKey] },
  })
  return container
}

export async function getOrdersContainer(): Promise<Container> {
  return ensureContainer("orders", "/orderId")
}

export async function getCustomersContainer(): Promise<Container> {
  return ensureContainer("customers", "/kundennummer")
}

export async function getSettingsContainer(): Promise<Container> {
  return ensureContainer("settings", "/id")
}

export async function getProductsContainer(): Promise<Container> {
  return ensureContainer("products", "/id")
}
