import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  MATERIAL_STATS_DOC_ID,
  MATERIAL_STATS_DOC_TYPE,
  mergeMaterialStats,
  sanitizeMaterialStatsInput,
  type MaterialStatsMap,
} from "@/lib/admin/material-stats-types"
import type { FilamentMaterialType } from "@/lib/admin/filament-types"

type MaterialStatsCosmosDoc = {
  id: string
  docType: string
  categories: Partial<
    Record<FilamentMaterialType, Partial<MaterialStatsMap[FilamentMaterialType]>>
  >
  updatedAt: string
}

export async function cosmosGetMaterialStats(): Promise<MaterialStatsMap> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(MATERIAL_STATS_DOC_ID, MATERIAL_STATS_DOC_ID)
      .read<MaterialStatsCosmosDoc>()
    if (resource?.docType === MATERIAL_STATS_DOC_TYPE) {
      return mergeMaterialStats(resource.categories)
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      logCosmosError("cosmosGetMaterialStats", error)
      throw error
    }
  }
  return mergeMaterialStats(null)
}

export async function cosmosSaveMaterialStats(
  categories: MaterialStatsMap
): Promise<MaterialStatsMap> {
  const container = await getSettingsContainer()
  const sanitized = sanitizeMaterialStatsInput(categories)
  const doc: MaterialStatsCosmosDoc = {
    id: MATERIAL_STATS_DOC_ID,
    docType: MATERIAL_STATS_DOC_TYPE,
    categories: sanitized,
    updatedAt: new Date().toISOString(),
  }
  await container.items.upsert(doc)
  return sanitized
}
