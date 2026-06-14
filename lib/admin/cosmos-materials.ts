import { getInventoryContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  MATERIAL_DOC_TYPE,
  type MaterialCategory,
  type MaterialItem,
  type MaterialVariant,
} from "@/lib/admin/material-types"
import { normalizeMaterialTypeKey } from "@/lib/admin/material-stats-types"

type CosmosMaterialDoc = MaterialItem & {
  id: string
  /** Legacy-Feld */
  variants?: MaterialVariant[]
  imageUrl?: string
}

function migrateLegacyVariantFields(raw: CosmosMaterialDoc): Partial<MaterialItem> {
  const legacyVariants = Array.isArray(raw.variants) ? raw.variants : []
  const first = legacyVariants[0]

  return {
    farbe: raw.farbe?.trim() || first?.farbe?.trim() || undefined,
    farbeBildUrl:
      raw.farbeBildUrl?.trim() ||
      first?.farbeBildUrl?.trim() ||
      raw.imageUrl?.trim() ||
      undefined,
    stockAvailable:
      legacyVariants.length > 0
        ? legacyVariants.reduce((sum, v) => sum + Math.max(0, Number(v.stockAvailable) || 0), 0)
        : undefined,
    stockReserved:
      legacyVariants.length > 0
        ? legacyVariants.reduce((sum, v) => sum + Math.max(0, Number(v.stockReserved) || 0), 0)
        : undefined,
  }
}

export function normalizeMaterialItem(raw: Partial<MaterialItem> & { id: string }): MaterialItem {
  const category = (["filament", "lasermaterial", "sonstiges"] as MaterialCategory[]).includes(
    raw.category as MaterialCategory
  )
    ? (raw.category as MaterialCategory)
    : "filament"

  const legacy = migrateLegacyVariantFields(raw as CosmosMaterialDoc)

  const materialType = raw.materialType?.trim()
    ? normalizeMaterialTypeKey(raw.materialType)
    : undefined

  return {
    id: raw.id,
    docType: MATERIAL_DOC_TYPE,
    category,
    name: String(raw.name ?? "").trim() || "Unbenannt",
    manufacturer: raw.manufacturer?.trim() || undefined,
    materialType: category === "filament" ? materialType : undefined,
    farbe: legacy.farbe ?? (raw.farbe?.trim() || undefined),
    filamentCode: raw.filamentCode?.trim() || undefined,
    farbeBildUrl: legacy.farbeBildUrl ?? (raw.farbeBildUrl?.trim() || undefined),
    stockUnit: raw.stockUnit === "piece" ? "piece" : "gram",
    stockAvailable: Math.max(
      0,
      Math.round(Number(legacy.stockAvailable ?? raw.stockAvailable) || 0)
    ),
    stockReserved: Math.max(
      0,
      Math.round(Number(legacy.stockReserved ?? raw.stockReserved) || 0)
    ),
    bemerkungen: raw.bemerkungen?.trim() || undefined,
    mindestbestand:
      raw.mindestbestand != null ? Math.max(0, Math.round(Number(raw.mindestbestand))) : undefined,
    lieferant: raw.lieferant?.trim() || undefined,
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  }
}

export async function cosmosGetMaterials(
  category?: MaterialCategory
): Promise<MaterialItem[]> {
  const container = await getInventoryContainer()
  const query =
    category != null
      ? {
          query:
            "SELECT * FROM c WHERE c.docType = @docType AND c.category = @category ORDER BY c.name ASC",
          parameters: [
            { name: "@docType", value: MATERIAL_DOC_TYPE },
            { name: "@category", value: category },
          ],
        }
      : {
          query: "SELECT * FROM c WHERE c.docType = @docType ORDER BY c.name ASC",
          parameters: [{ name: "@docType", value: MATERIAL_DOC_TYPE }],
        }

  const { resources } = await container.items
    .query<CosmosMaterialDoc>(query)
    .fetchAll()

  return resources.map((doc) => normalizeMaterialItem(doc))
}

export async function cosmosGetMaterialById(id: string): Promise<MaterialItem | null> {
  const container = await getInventoryContainer()
  try {
    const { resource } = await container.item(id, id).read<CosmosMaterialDoc>()
    if (!resource || resource.docType !== MATERIAL_DOC_TYPE) return null
    return normalizeMaterialItem(resource)
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetMaterialById:${id}`, error)
    throw error
  }
}

export async function cosmosUpsertMaterial(material: MaterialItem): Promise<MaterialItem> {
  const container = await getInventoryContainer()
  const doc = { ...material, id: material.id }
  await container.items.upsert(doc)
  return material
}

export async function cosmosDeleteMaterial(id: string): Promise<boolean> {
  const container = await getInventoryContainer()
  try {
    const existing = await cosmosGetMaterialById(id)
    if (!existing) return false
    await container.item(id, id).delete()
    return true
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return false
    throw error
  }
}
