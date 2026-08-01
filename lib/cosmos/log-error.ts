/** Maskiert sensible Teile für sicheres Server-Logging. */
export function maskCosmosEndpoint(endpoint?: string): string {
  if (!endpoint?.trim()) return "(nicht gesetzt)"
  try {
    const url = new URL(endpoint)
    return `${url.protocol}//${url.hostname}/...`
  } catch {
    return "(ungültige URL)"
  }
}

export function formatCosmosError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") {
    return { message: String(error) }
  }

  const err = error as {
    message?: string
    code?: number | string
    statusCode?: number
    substatus?: number
    body?: { message?: string }
    diagnostics?: unknown
  }

  return {
    message: err.message ?? err.body?.message ?? "Unbekannter Cosmos-Fehler",
    code: err.code,
    statusCode: err.statusCode,
    substatus: err.substatus,
    diagnostics: err.diagnostics,
  }
}

export function logCosmosError(context: string, error: unknown): void {
  const endpoint =
    process.env.COSMOSDB_ENDPOINT ||
    process.env.COSMOS_DB_ENDPOINT ||
    process.env.AZURE_COSMOS_ENDPOINT ||
    process.env.COSMOS_ENDPOINT
  console.error(`Cosmos DB [${context}]:`, {
    ...formatCosmosError(error),
    endpoint: maskCosmosEndpoint(endpoint),
    database:
      process.env.COSMOSDB_DATABASE?.trim() ||
      process.env.COSMOS_DB_DATABASE?.trim() ||
      "dripforge",
    nodeEnv: process.env.NODE_ENV,
  })
}
