import { CosmosClient, type Container, type Database } from "@azure/cosmos"
import { logCosmosError } from "@/lib/cosmos/log-error"

const DATABASE_ID = process.env.COSMOSDB_DATABASE?.trim() || "dripforge"

/** Request-Timeout in ms (Azure SWA: etwas grosszuegiger). */
const REQUEST_TIMEOUT_MS = Number(process.env.COSMOSDB_REQUEST_TIMEOUT_MS ?? 60_000)

const MAX_RETRY_ATTEMPTS = Number(process.env.COSMOSDB_MAX_RETRIES ?? 5)

let client: CosmosClient | null = null
let databaseReady: Promise<Database> | null = null
const containerReady = new Map<string, Promise<Container>>()

export function isCosmosConfigured(): boolean {
  const endpoint = process.env.COSMOSDB_ENDPOINT?.trim() ?? ""
  const key = process.env.COSMOSDB_KEY?.trim() ?? ""
  if (!endpoint || !key) return false
  if (endpoint.includes("placeholder") || key.includes("placeholder")) return false
  return true
}

function resetCosmosCaches(): void {
  databaseReady = null
  containerReady.clear()
}

export function getCosmosClient(): CosmosClient {
  if (!isCosmosConfigured()) {
    throw new Error("Cosmos DB ist nicht konfiguriert (COSMOSDB_ENDPOINT / COSMOSDB_KEY).")
  }
  if (!client) {
    try {
      client = new CosmosClient({
        endpoint: process.env.COSMOSDB_ENDPOINT!,
        key: process.env.COSMOSDB_KEY!,
        connectionPolicy: {
          requestTimeout: REQUEST_TIMEOUT_MS,
          enableEndpointDiscovery: true,
          retryOptions: {
            maxRetryAttemptCount: MAX_RETRY_ATTEMPTS,
            fixedRetryIntervalInMilliseconds: 1000,
            maxWaitTimeInSeconds: 60,
          },
        },
      })
      console.info("Cosmos DB: Client initialisiert.", {
        endpoint: process.env.COSMOSDB_ENDPOINT?.replace(/\/\/[^/]+/, "//***"),
        database: DATABASE_ID,
        requestTimeoutMs: REQUEST_TIMEOUT_MS,
        maxRetries: MAX_RETRY_ATTEMPTS,
      })
    } catch (error) {
      logCosmosError("getCosmosClient", error)
      throw error
    }
  }
  return client
}

async function ensureDatabase(): Promise<Database> {
  if (!databaseReady) {
    databaseReady = (async () => {
      const cosmos = getCosmosClient()
      try {
        const { database } = await cosmos.databases.createIfNotExists({
          id: DATABASE_ID,
        })
        console.info(`Cosmos DB: Datenbank "${DATABASE_ID}" bereit.`)
        return database
      } catch (createError) {
        logCosmosError("databases.createIfNotExists", createError)
        try {
          const database = cosmos.database(DATABASE_ID)
          await database.read()
          console.info(
            `Cosmos DB: Datenbank "${DATABASE_ID}" per read() erreichbar (create uebersprungen).`
          )
          return database
        } catch (readError) {
          resetCosmosCaches()
          logCosmosError("database.read", readError)
          throw readError
        }
      }
    })()
  }

  try {
    return await databaseReady
  } catch (error) {
    resetCosmosCaches()
    throw error
  }
}

async function ensureContainer(
  containerId: string,
  partitionKey: string
): Promise<Container> {
  const cacheKey = `${containerId}:${partitionKey}`
  let pending = containerReady.get(cacheKey)

  if (!pending) {
    pending = (async () => {
      const database = await ensureDatabase()
      try {
        const { container } = await database.containers.createIfNotExists({
          id: containerId,
          partitionKey: { paths: [partitionKey] },
        })
        console.info(`Cosmos DB: Container "${containerId}" bereit.`)
        return container
      } catch (createError) {
        logCosmosError(`containers.createIfNotExists(${containerId})`, createError)
        try {
          const container = database.container(containerId)
          await container.read()
          console.info(
            `Cosmos DB: Container "${containerId}" per read() erreichbar (create uebersprungen).`
          )
          return container
        } catch (readError) {
          containerReady.delete(cacheKey)
          logCosmosError(`container.read(${containerId})`, readError)
          throw readError
        }
      }
    })()
    containerReady.set(cacheKey, pending)
  }

  try {
    return await pending
  } catch (error) {
    containerReady.delete(cacheKey)
    throw error
  }
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

export async function getInventoryContainer(): Promise<Container> {
  return ensureContainer("inventory", "/id")
}

export async function getCouponsContainer(): Promise<Container> {
  return ensureContainer("coupons", "/id")
}

export async function getCustomerAccountsContainer(): Promise<Container> {
  return ensureContainer("customer-accounts", "/id")
}

export async function getCustomerDesignsContainer(): Promise<Container> {
  return ensureContainer("customer-designs", "/customerEmail")
}

export async function getStaffAccountsContainer(): Promise<Container> {
  return ensureContainer("staff-accounts", "/id")
}
