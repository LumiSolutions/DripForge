import { CosmosClient, type Container, type Database } from "@azure/cosmos"
import { logCosmosError, maskCosmosEndpoint } from "@/lib/cosmos/log-error"

const SETTINGS_PARTITION_KEY = "/id"

/** Request-Timeout in ms (Azure SWA: etwas grosszuegiger). */
function requestTimeoutMs(): number {
  return Number(process.env.COSMOSDB_REQUEST_TIMEOUT_MS ?? 60_000)
}

function maxRetryAttempts(): number {
  return Number(process.env.COSMOSDB_MAX_RETRIES ?? 5)
}

let client: CosmosClient | null = null
let clientFingerprint: string | null = null
let databaseReady: Promise<Database> | null = null
const containerReady = new Map<string, Promise<Container>>()

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function readCosmosEnv(...names: string[]): string {
  for (const name of names) {
    const raw = process.env[name]
    if (raw == null || !String(raw).trim()) continue
    const value = stripEnvQuotes(String(raw))
    if (value) return value
  }
  return ""
}

export type CosmosCredentials = {
  endpoint: string
  key: string
}

/** Runtime-Credentials — immer frisch aus process.env (Azure SWA App Settings). */
export function resolveCosmosCredentials(): CosmosCredentials | null {
  const endpoint = readCosmosEnv(
    "COSMOSDB_ENDPOINT",
    "COSMOS_DB_ENDPOINT",
    "AZURE_COSMOS_ENDPOINT",
    "COSMOS_ENDPOINT"
  )
  const key = readCosmosEnv(
    "COSMOSDB_KEY",
    "COSMOS_DB_KEY",
    "AZURE_COSMOS_KEY",
    "COSMOS_KEY"
  )
  if (!endpoint || !key) return null
  const lower = `${endpoint} ${key}`.toLowerCase()
  if (
    lower.includes("placeholder") ||
    lower.includes("your_secret") ||
    lower.includes("your-secret") ||
    endpoint.includes("YOUR_ACCOUNT")
  ) {
    return null
  }
  return { endpoint, key }
}

export function isCosmosConfigured(): boolean {
  return resolveCosmosCredentials() != null
}

export function resetCosmosCaches(): void {
  client = null
  clientFingerprint = null
  databaseReady = null
  containerReady.clear()
}

export function getCosmosDatabaseId(): string {
  return (
    readCosmosEnv("COSMOSDB_DATABASE", "COSMOS_DB_DATABASE", "AZURE_COSMOS_DATABASE") ||
    "dripforge"
  )
}

export function getSettingsContainerId(): string {
  return readCosmosEnv("COSMOSDB_SETTINGS_CONTAINER") || "settings"
}

export function getCosmosClient(): CosmosClient {
  const creds = resolveCosmosCredentials()
  if (!creds) {
    throw new Error("Cosmos DB ist nicht konfiguriert (COSMOSDB_ENDPOINT / COSMOSDB_KEY).")
  }
  const fingerprint = `${creds.endpoint}::${creds.key.slice(0, 8)}`
  if (client && clientFingerprint !== fingerprint) {
    resetCosmosCaches()
  }
  if (!client) {
    try {
      client = new CosmosClient({
        endpoint: creds.endpoint,
        key: creds.key,
        connectionPolicy: {
          requestTimeout: requestTimeoutMs(),
          enableEndpointDiscovery: true,
          retryOptions: {
            maxRetryAttemptCount: maxRetryAttempts(),
            fixedRetryIntervalInMilliseconds: 1000,
            maxWaitTimeInSeconds: 60,
          },
        },
      })
      clientFingerprint = fingerprint
      console.info("Cosmos DB: Client initialisiert.", {
        endpoint: maskCosmosEndpoint(creds.endpoint),
        database: getCosmosDatabaseId(),
        settingsContainer: getSettingsContainerId(),
        requestTimeoutMs: requestTimeoutMs(),
        maxRetries: maxRetryAttempts(),
      })
    } catch (error) {
      resetCosmosCaches()
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
          id: getCosmosDatabaseId(),
        })
        console.info(`Cosmos DB: Datenbank "${getCosmosDatabaseId()}" bereit.`)
        return database
      } catch (createError) {
        logCosmosError("databases.createIfNotExists", createError)
        try {
          const database = cosmos.database(getCosmosDatabaseId())
          await database.read()
          console.info(
            `Cosmos DB: Datenbank "${getCosmosDatabaseId()}" per read() erreichbar (create übersprungen).`
          )
          return database
        } catch (readError) {
          resetCosmosCaches()
          logCosmosError("database.read", readError)
          throw new Error(
            `Cosmos-Datenbank "${getCosmosDatabaseId()}" nicht gefunden. Prüfe COSMOSDB_DATABASE / Azure Portal.`,
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
            `Cosmos-Container "${containerId}" in Datenbank "${getCosmosDatabaseId()}" nicht gefunden ` +
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
  const creds = resolveCosmosCredentials()
  console.info("Cosmos DB: Konfigurationsstatus.", {
    configured: Boolean(creds),
    endpoint: maskCosmosEndpoint(creds?.endpoint),
    database: getCosmosDatabaseId(),
    settingsContainer: getSettingsContainerId(),
    hasKey: Boolean(creds?.key),
    nodeEnv: process.env.NODE_ENV,
  })
  if (!creds) {
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
  await softWarm("inventory", async () => {
    await getInventoryContainer()
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
  return ensureContainer(getSettingsContainerId(), SETTINGS_PARTITION_KEY)
}

export async function getProductsContainer(): Promise<Container> {
  const { resolveProductsContainer } = await import("@/lib/cosmos/products-container")
  const { container } = await resolveProductsContainer()
  return container
}

/**
 * Lager-/Material-Container. Wenn «inventory» fehlt (shared RU / Portal),
 * Fallback auf settings — Material-Docs haben docType und kollidieren nicht.
 */
export async function getInventoryContainer(): Promise<Container> {
  const preferred =
    readCosmosEnv("COSMOSDB_INVENTORY_CONTAINER", "COSMOS_INVENTORY_CONTAINER") ||
    "inventory"
  try {
    return await ensureContainer(preferred, "/id")
  } catch (primaryError) {
    logCosmosError(`getInventoryContainer:${preferred}`, primaryError)
    console.warn(
      `Cosmos DB: Container "${preferred}" nicht verfügbar — Fallback auf settings für Lagerdokumente.`
    )
    return getSettingsContainer()
  }
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
