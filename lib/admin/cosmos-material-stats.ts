import {
  ensureSettingsReady,
  getCosmosDatabaseId,
  getSettingsContainerId,
  resetCosmosCaches,
} from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  MATERIAL_STATS_DOC_ID,
  MATERIAL_STATS_DOC_TYPE,
  mergeMaterialTypes,
  sanitizeMaterialTypesInput,
  typesToLegacyMap,
  type MaterialStatsMap,
  type MaterialTypeDefinition,
} from "@/lib/admin/material-stats-types"

type MaterialStatsCosmosDoc = {
  id: string
  docType: string
  types?: MaterialTypeDefinition[]
  categories?: Partial<Record<string, Partial<MaterialTypeDefinition>>>
  updatedAt: string
}

function cosmosStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const err = error as { code?: number | string; statusCode?: number }
  const code = err.statusCode ?? err.code
  return typeof code === "number" ? code : Number(code) || undefined
}

export async function cosmosGetMaterialTypes(): Promise<MaterialTypeDefinition[]> {
  const container = await ensureSettingsReady()
  try {
    const { resource } = await container
      .item(MATERIAL_STATS_DOC_ID, MATERIAL_STATS_DOC_ID)
      .read<MaterialStatsCosmosDoc>()
    if (resource?.docType === MATERIAL_STATS_DOC_TYPE) {
      if (Array.isArray(resource.types)) {
        return mergeMaterialTypes(resource.types)
      }
      return mergeMaterialTypes(resource.categories)
    }
  } catch (error) {
    if (cosmosStatusCode(error) !== 404) {
      logCosmosError("cosmosGetMaterialTypes", error)
      throw error
    }
  }
  return mergeMaterialTypes(null)
}

export async function cosmosGetMaterialStats(): Promise<MaterialStatsMap> {
  const types = await cosmosGetMaterialTypes()
  return typesToLegacyMap(types)
}

async function upsertMaterialStatsDoc(
  doc: MaterialStatsCosmosDoc
): Promise<void> {
  const container = await ensureSettingsReady()
  // settings-Container PK = /id — doc.id ist der Partition-Key-Wert
  await container.items.upsert(doc)
}

export async function cosmosSaveMaterialTypes(
  types: MaterialTypeDefinition[]
): Promise<MaterialTypeDefinition[]> {
  const sanitized = sanitizeMaterialTypesInput(types)
  const doc: MaterialStatsCosmosDoc = {
    id: MATERIAL_STATS_DOC_ID,
    docType: MATERIAL_STATS_DOC_TYPE,
    types: sanitized,
    updatedAt: new Date().toISOString(),
  }

  try {
    await upsertMaterialStatsDoc(doc)
    return sanitized
  } catch (error) {
    const code = cosmosStatusCode(error)
    logCosmosError("cosmosSaveMaterialTypes", error)
    console.error("cosmosSaveMaterialTypes: Kontext", {
      database: getCosmosDatabaseId(),
      container: getSettingsContainerId(),
      partitionKey: "/id",
      documentId: MATERIAL_STATS_DOC_ID,
      statusCode: code,
    })

    // Bei Resource Not Found: Cache leeren, settings erneut sicherstellen, 1× retry
    if (code === 404) {
      resetCosmosCaches()
      try {
        await upsertMaterialStatsDoc(doc)
        return sanitized
      } catch (retryError) {
        logCosmosError("cosmosSaveMaterialTypes:retry", retryError)
        throw new Error(
          `Material-Arten konnten nicht in Cosmos gespeichert werden: Resource Not Found ` +
            `(DB «${getCosmosDatabaseId()}», Container «${getSettingsContainerId()}», ` +
            `Dokument «${MATERIAL_STATS_DOC_ID}», PK /id). ` +
            `Prüfe COSMOSDB_DATABASE / COSMOSDB_SETTINGS_CONTAINER und dass der settings-Container existiert.`,
          { cause: retryError }
        )
      }
    }

    throw error
  }
}

export async function cosmosSaveMaterialStats(
  categories: MaterialStatsMap
): Promise<MaterialStatsMap> {
  const types = mergeMaterialTypes(categories)
  const saved = await cosmosSaveMaterialTypes(types)
  return typesToLegacyMap(saved)
}
