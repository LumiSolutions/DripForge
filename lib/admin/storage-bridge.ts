import { isCosmosConfigured } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"

/** Admin-Mutationen: kein Dateisystem-Fallback (SWA ist fluechtig). */
export class CosmosDatabaseError extends Error {
  constructor(operation: string, cause?: unknown) {
    super("Datenbank nicht erreichbar")
    this.name = "CosmosDatabaseError"
    if (cause instanceof Error) {
      this.cause = cause
    }
    logCosmosError(`cosmos-required:${operation}`, cause)
  }
}

/**
 * Cosmos ist auf Azure primaer — bei Verbindungsfehlern Fallback auf Dateisystem
 * (Lesezugriff aus dem Deployment, Schreiben nur best-effort).
 */
export async function withCosmosFallback<T>(
  operation: string,
  cosmosFn: () => Promise<T>,
  fileFn: () => Promise<T>
): Promise<T> {
  if (!isCosmosConfigured()) {
    return fileFn()
  }

  try {
    return await cosmosFn()
  } catch (error) {
    logCosmosError(`storage-bridge:${operation}`, error)
    console.error(
      `Speicher [${operation}]: Cosmos fehlgeschlagen — Fallback auf Dateisystem (Azure: Daten evtl. nicht persistent).`
    )
    return fileFn()
  }
}

/** Admin-Schreibzugriffe: nur Cosmos, sonst harter Fehler. */
export async function withCosmosRequired<T>(
  operation: string,
  cosmosFn: () => Promise<T>
): Promise<T> {
  if (!isCosmosConfigured()) {
    throw new CosmosDatabaseError(operation, new Error("COSMOSDB nicht konfiguriert"))
  }

  try {
    return await cosmosFn()
  } catch (error) {
    if (error instanceof CosmosDatabaseError) throw error
    throw new CosmosDatabaseError(operation, error)
  }
}
