import {
  ensureSettingsReady,
  getCosmosDatabaseId,
  getSettingsContainerId,
  resetCosmosCaches,
} from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  mergeLaserMaterialTypes,
  sanitizeLaserMaterialTypesInput,
  type LaserMaterialTypeDefinition,
} from "@/lib/admin/laser-material-types"
import {
  MATERIAL_STATS_DOC_ID,
  MATERIAL_STATS_DOC_TYPE,
  mergeMaterialTypes,
  normalizeMaterialTypeDefinition,
  sanitizeMaterialTypesInput,
  typesToLegacyMap,
  type MaterialStatsMap,
  type MaterialTypeDefinition,
} from "@/lib/admin/material-stats-types"

type MaterialStatsCosmosDoc = {
  id: string
  docType: string
  types?: MaterialTypeDefinition[]
  laserTypes?: LaserMaterialTypeDefinition[]
  categories?: Partial<Record<string, Partial<MaterialTypeDefinition>>>
  updatedAt: string
}

function cosmosStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const err = error as { code?: number | string; statusCode?: number }
  const code = err.statusCode ?? err.code
  return typeof code === "number" ? code : Number(code) || undefined
}

async function cosmosReadMaterialStatsDoc(): Promise<MaterialStatsCosmosDoc | null> {
  const container = await ensureSettingsReady()
  try {
    const { resource } = await container
      .item(MATERIAL_STATS_DOC_ID, MATERIAL_STATS_DOC_ID)
      .read<MaterialStatsCosmosDoc>()
    if (resource?.docType === MATERIAL_STATS_DOC_TYPE) return resource
  } catch (error) {
    if (cosmosStatusCode(error) !== 404) {
      logCosmosError("cosmosReadMaterialStatsDoc", error)
      throw error
    }
  }
  return null
}

export async function cosmosGetMaterialTypes(): Promise<MaterialTypeDefinition[]> {
  try {
    const resource = await cosmosReadMaterialStatsDoc()
    if (resource) {
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

export async function cosmosGetLaserMaterialTypes(): Promise<
  LaserMaterialTypeDefinition[]
> {
  try {
    const resource = await cosmosReadMaterialStatsDoc()
    if (resource) {
      return mergeLaserMaterialTypes(resource.laserTypes)
    }
  } catch (error) {
    if (cosmosStatusCode(error) !== 404) {
      logCosmosError("cosmosGetLaserMaterialTypes", error)
      throw error
    }
  }
  return mergeLaserMaterialTypes(null)
}

export async function cosmosGetMaterialStats(): Promise<MaterialStatsMap> {
  const types = await cosmosGetMaterialTypes()
  return typesToLegacyMap(types)
}

async function upsertMaterialStatsDoc(doc: MaterialStatsCosmosDoc): Promise<void> {
  const container = await ensureSettingsReady()
  // settings-Container PK = /id — doc.id ist der Partition-Key-Wert
  await container.items.upsert(doc)
}

async function upsertMaterialStatsDocWithRetry(
  doc: MaterialStatsCosmosDoc,
  opName: string
): Promise<void> {
  try {
    await upsertMaterialStatsDoc(doc)
  } catch (error) {
    const code = cosmosStatusCode(error)
    logCosmosError(opName, error)
    console.error(`${opName}: Kontext`, {
      database: getCosmosDatabaseId(),
      container: getSettingsContainerId(),
      partitionKey: "/id",
      documentId: MATERIAL_STATS_DOC_ID,
      statusCode: code,
    })

    if (code === 404) {
      resetCosmosCaches()
      try {
        await upsertMaterialStatsDoc(doc)
        return
      } catch (retryError) {
        logCosmosError(`${opName}:retry`, retryError)
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

export async function cosmosSaveMaterialTypes(
  types: MaterialTypeDefinition[]
): Promise<MaterialTypeDefinition[]> {
  const sanitized = sanitizeMaterialTypesInput(types)
  const existing = await cosmosReadMaterialStatsDoc()
  const doc: MaterialStatsCosmosDoc = {
    id: MATERIAL_STATS_DOC_ID,
    docType: MATERIAL_STATS_DOC_TYPE,
    types: sanitized,
    laserTypes: existing?.laserTypes,
    updatedAt: new Date().toISOString(),
  }

  await upsertMaterialStatsDocWithRetry(doc, "cosmosSaveMaterialTypes")
  return sanitized
}

export async function cosmosSaveLaserMaterialTypes(
  laserTypes: LaserMaterialTypeDefinition[]
): Promise<LaserMaterialTypeDefinition[]> {
  const sanitized = sanitizeLaserMaterialTypesInput(laserTypes)
  const existing = await cosmosReadMaterialStatsDoc()
  // Filament-Typen nur lesen/weiterreichen — niemals Defaults neu einmischen.
  let filamentTypes: MaterialTypeDefinition[] | undefined
  if (Array.isArray(existing?.types)) {
    filamentTypes = existing.types.map((raw) =>
      normalizeMaterialTypeDefinition(raw)
    )
  } else if (existing?.categories) {
    filamentTypes = mergeMaterialTypes(existing.categories)
  }

  const doc: MaterialStatsCosmosDoc = {
    id: MATERIAL_STATS_DOC_ID,
    docType: MATERIAL_STATS_DOC_TYPE,
    ...(filamentTypes ? { types: filamentTypes } : {}),
    laserTypes: sanitized,
    updatedAt: new Date().toISOString(),
  }

  await upsertMaterialStatsDocWithRetry(doc, "cosmosSaveLaserMaterialTypes")
  return sanitized
}

export async function cosmosSaveMaterialStats(
  categories: MaterialStatsMap
): Promise<MaterialStatsMap> {
  const types = mergeMaterialTypes(categories)
  const saved = await cosmosSaveMaterialTypes(types)
  return typesToLegacyMap(saved)
}
