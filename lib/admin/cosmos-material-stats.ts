import { getSettingsContainer } from "@/lib/cosmos/client"
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

export async function cosmosGetMaterialTypes(): Promise<MaterialTypeDefinition[]> {
  const container = await getSettingsContainer()
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
    const code = (error as { code?: number }).code
    if (code !== 404) {
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

export async function cosmosSaveMaterialTypes(
  types: MaterialTypeDefinition[]
): Promise<MaterialTypeDefinition[]> {
  const container = await getSettingsContainer()
  const sanitized = sanitizeMaterialTypesInput(types)
  const doc: MaterialStatsCosmosDoc = {
    id: MATERIAL_STATS_DOC_ID,
    docType: MATERIAL_STATS_DOC_TYPE,
    types: sanitized,
    updatedAt: new Date().toISOString(),
  }
  await container.items.upsert(doc)
  return sanitized
}

export async function cosmosSaveMaterialStats(
  categories: MaterialStatsMap
): Promise<MaterialStatsMap> {
  const types = mergeMaterialTypes(categories)
  const saved = await cosmosSaveMaterialTypes(types)
  return typesToLegacyMap(saved)
}
