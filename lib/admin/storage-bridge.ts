import { isCosmosConfigured } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"

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
