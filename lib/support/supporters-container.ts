import type { Container } from "@azure/cosmos"
import { ensureDatabase, getSettingsContainer } from "@/lib/cosmos/client"

export type SupportersStorageMode = "dedicated" | "shared"

type SupportersContainerState = {
  container: Container
  mode: SupportersStorageMode
}

let resolved: SupportersContainerState | null = null

/**
 * Supporter-Daten: dedizierter Container wenn vorhanden, sonst settings-Container
 * (docType=project-supporter) — wichtig bei Cosmos RU-Limits.
 */
export async function resolveSupportersContainer(): Promise<SupportersContainerState> {
  if (resolved) return resolved

  const database = await ensureDatabase()

  try {
    const dedicated = database.container("project-supporters")
    await dedicated.read()
    resolved = { container: dedicated, mode: "dedicated" }
    console.info("Cosmos DB: Container 'project-supporters' aktiv.")
    return resolved
  } catch {
    const shared = await getSettingsContainer()
    resolved = { container: shared, mode: "shared" }
    console.warn(
      "Cosmos DB: Container 'project-supporters' nicht verfügbar — Supporter werden im Container 'settings' (docType=project-supporter) gespeichert."
    )
    return resolved
  }
}

export function resetSupportersContainerCache(): void {
  resolved = null
}
