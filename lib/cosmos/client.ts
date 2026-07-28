import { CosmosClient, type Container, type Database } from "@azure/cosmos"
import { logCosmosError, maskCosmosEndpoint } from "@/lib/cosmos/log-error"

const DATABASE_ID = process.env.COSMOSDB_DATABASE?.trim() || "dripforge"
const SETTINGS_CONTAINER_ID =
  process.env.COSMOSDB_SETTINGS_CONTAINER?.trim() || "settings"
const SETTINGS_PARTITION_KEY = "/id"

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

export function resetCosmosCaches(): void {
  databaseReady = null
  containerReady.clear()
}

export function getCosmosDatabaseId(): string {
  return DATABASE_ID
}

export function getSettingsContainerId(): string {
  return SETTINGS_CONTAINER_ID
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
        settingsContainer: SETTINGS_CONTAINER_ID,
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

export async function ensureDatabase(): Promise<Database> {
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
            `Cosmos DB: Datenbank "${DATABASE_ID}" per read() erreichbar (create übersprungen).`
          )
          return database
        } catch (readError) {
          resetCosmosCaches()
          logCosmosError("database.read", readError)
          throw new Error(
            `Cosmos-Datenbank "${DATABASE_ID}" nicht gefunden. Prüfe COSMOSDB_DATABASE / Azure Portal.`,
            { cause: readError }
          )
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

function cosmosStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const err = error as { code?: number | string; statusCode?: number }
  const code = err.statusCode ?? err.code
  return typeof code === "number" ? code : Number(code) || undefined
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
        console.info(
          `Cosmos DB: Container "${containerId}" bereit (PK ${partitionKey}).`
        )
        return container
      } catch (createError) {
        logCosmosError(`containers.createIfNotExists(${containerId})`, createError)
        try {
          const container = database.container(containerId)
          await container.read()
          console.info(
            `Cosmos DB: Container "${containerId}" per read() erreichbar (create übersprungen).`
          )
          return container
        } catch (readError) {
          containerReady.delete(cacheKey)
          logCosmosError(`container.read(${containerId})`, readError)
          throw new Error(
            `Cosmos-Container "${containerId}" in Datenbank "${DATABASE_ID}" nicht gefunden ` +
              `(Partition Key erwartet: ${partitionKey}). ` +
              `Unter shared/1000 RU muss der Container im Azure Portal existieren.`,
            { cause: readError }
          )
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

/** Optionalen Container warm machen — Fehler blockieren den Request nicht. */
async function softWarm(
  label: string,
  fn: () => Promise<unknown>
): Promise<void> {
  try {
    await fn()
  } catch (error) {
    console.warn(`Cosmos DB: Optionales Warm-up «${label}» übersprungen.`, {
      message: error instanceof Error ? error.message : String(error),
      code: cosmosStatusCode(error),
    })
  }
}

export function logCosmosConfigStatus(): void {
  const configured = isCosmosConfigured()
  console.info("Cosmos DB: Konfigurationsstatus.", {
    configured,
    endpoint: maskCosmosEndpoint(process.env.COSMOSDB_ENDPOINT),
    database: DATABASE_ID,
    settingsContainer: SETTINGS_CONTAINER_ID,
    hasKey: Boolean(process.env.COSMOSDB_KEY?.trim()),
    nodeEnv: process.env.NODE_ENV,
  })
  if (!configured) {
    console.warn(
      "Cosmos DB: COSMOSDB_ENDPOINT / COSMOSDB_KEY fehlen oder sind Platzhalter — APIs nutzen lokale JSON-Fallbacks."
    )
  }
}

/**
 * Kern-Container beim Start vorbereiten.
 * settings ist Pflicht; customers/products dürfen nicht den ganzen Request killen
 * (oft fehlt customers bei festen RU-Limits → "Resource Not Found").
 */
export async function warmCosmosCore(): Promise<void> {
  if (!isCosmosConfigured()) {
    logCosmosConfigStatus()
    return
  }
  logCosmosConfigStatus()
  await ensureDatabase()
  await getSettingsContainer()
  await softWarm("customers", async () => {
    const { resolveCustomersContainer } = await import("@/lib/cosmos/customers-container")
    await resolveCustomersContainer()
  })
  await softWarm("customer-accounts", async () => {
    const { resolveCustomerAccountsContainer } = await import(
      "@/lib/cosmos/customer-accounts-container"
    )
    await resolveCustomerAccountsContainer()
  })
  await softWarm("orders", async () => {
    const { resolveOrdersContainer } = await import("@/lib/cosmos/orders-container")
    await resolveOrdersContainer()
  })
  await softWarm("products", async () => {
    const { resolveProductsContainer } = await import("@/lib/cosmos/products-container")
    await resolveProductsContainer()
  })
}

/** @deprecated Alias — nutzt warmCosmosCore. */
export async function warmCosmosInfrastructure(): Promise<void> {
  await warmCosmosCore()
}

/** Nur settings-Container — für Material-Arten / Settings-Dokumente. */
export async function ensureSettingsReady(): Promise<Container> {
  await ensureDatabase()
  return getSettingsContainer()
}

export async function getProjectSupportersContainer(): Promise<Container> {
  const { resolveSupportersContainer } = await import("@/lib/support/supporters-container")
  const { container } = await resolveSupportersContainer()
  return container
}

export async function getOrdersContainer(): Promise<Container> {
  const { resolveOrdersContainer } = await import("@/lib/cosmos/orders-container")
  const { container } = await resolveOrdersContainer()
  return container
}

export async function getCustomersContainer(): Promise<Container> {
  const { resolveCustomersContainer } = await import("@/lib/cosmos/customers-container")
  const { container } = await resolveCustomersContainer()
  return container
}

export async function getSettingsContainer(): Promise<Container> {
  return ensureContainer(SETTINGS_CONTAINER_ID, SETTINGS_PARTITION_KEY)
}

export async function getProductsContainer(): Promise<Container> {
  const { resolveProductsContainer } = await import("@/lib/cosmos/products-container")
  const { container } = await resolveProductsContainer()
  return container
}

export async function getInventoryContainer(): Promise<Container> {
  return ensureContainer("inventory", "/id")
}

export async function getCouponsContainer(): Promise<Container> {
  return ensureContainer("coupons", "/id")
}

export async function getCustomerAccountsContainer(): Promise<Container> {
  const { resolveCustomerAccountsContainer } = await import(
    "@/lib/cosmos/customer-accounts-container"
  )
  const { container } = await resolveCustomerAccountsContainer()
  return container
}

export async function getCustomerDesignsContainer(): Promise<Container> {
  return ensureContainer("customer-designs", "/customerEmail")
}

export async function getCustomerCartsContainer(): Promise<Container> {
  return ensureContainer("customer-carts", "/customerEmail")
}

export async function getStaffAccountsContainer(): Promise<Container> {
  return ensureContainer("staff-accounts", "/id")
}

export async function getChatContainer(): Promise<Container> {
  return ensureContainer("chat", "/sessionId")
}
