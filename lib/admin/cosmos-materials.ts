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
  /** @deprecated — wird beim Lesen nach printBildUrl migriert */
  farbeBildUrl?: string
}

function migrateLegacyVariantFields(raw: CosmosMaterialDoc): Partial<MaterialItem> {
  const legacyVariants = Array.isArray(raw.variants) ? raw.variants : []
  const first = legacyVariants[0]

  return {
    farbe: raw.farbe?.trim() || first?.farbe?.trim() || undefined,
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

function resolveMaterialImageUrls(raw: CosmosMaterialDoc): {
  spuleBildUrl?: string
  printBildUrl?: string
} {
  const legacyVariants = Array.isArray(raw.variants) ? raw.variants : []
  const first = legacyVariants[0]
  const legacyFarbeBildUrl =
    raw.farbeBildUrl?.trim() ||
    first?.farbeBildUrl?.trim() ||
    raw.imageUrl?.trim() ||
    undefined

  const spuleBildUrl = raw.spuleBildUrl?.trim() || undefined
  const printBildUrl = raw.printBildUrl?.trim() || legacyFarbeBildUrl || undefined

  return { spuleBildUrl, printBildUrl }
}

export function normalizeMaterialItem(raw: Partial<MaterialItem> & { id: string }): MaterialItem {
  const category = (["filament", "lasermaterial", "sonstiges"] as MaterialCategory[]).includes(
    raw.category as MaterialCategory
  )
    ? (raw.category as MaterialCategory)
    : "filament"

  const legacy = migrateLegacyVariantFields(raw as CosmosMaterialDoc)
  const imageUrls = resolveMaterialImageUrls(raw as CosmosMaterialDoc)

  const materialType = raw.materialType?.trim()
    ? category === "filament"
      ? normalizeMaterialTypeKey(raw.materialType)
      : raw.materialType.trim()
    : undefined

  return {
    id: raw.id,
    docType: MATERIAL_DOC_TYPE,
    category,
    name: String(raw.name ?? "").trim() || "Unbenannt",
    manufacturer: raw.manufacturer?.trim() || undefined,
    materialType,
    typ: category === "lasermaterial" ? raw.typ?.trim() || undefined : undefined,
    farbe: legacy.farbe ?? (raw.farbe?.trim() || undefined),
    filamentCode: category === "filament" ? raw.filamentCode?.trim() || undefined : undefined,
    dicke: category === "lasermaterial" ? raw.dicke?.trim() || undefined : undefined,
    formatGroesse:
      category === "lasermaterial" ? raw.formatGroesse?.trim() || undefined : undefined,
    spuleBildUrl: category === "filament" ? imageUrls.spuleBildUrl : undefined,
    printBildUrl: category === "filament" ? imageUrls.printBildUrl : undefined,
    materialImageUrl:
      category === "lasermaterial" ? raw.materialImageUrl?.trim() || undefined : undefined,
    sampleLaserImageUrl:
      category === "lasermaterial" ? raw.sampleLaserImageUrl?.trim() || undefined : undefined,
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
    purchasePrice:
      raw.purchasePrice != null
        ? Math.round(Math.max(0, Number(raw.purchasePrice) || 0) * 100) / 100
        : undefined,
    lieferant: raw.lieferant?.trim() || undefined,
    sortOrder: normalizeSortOrder(raw.sortOrder),
    colorHex: normalizeColorHex(raw.colorHex),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  }
}

function normalizeSortOrder(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n))
}

function normalizeColorHex(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed
  }
  return undefined
}

export async function cosmosGetMaterials(
  category?: MaterialCategory
): Promise<MaterialItem[]> {
  const container = await getInventoryContainer()
  const baseParams =
    category != null
      ? [
          { name: "@docType", value: MATERIAL_DOC_TYPE },
          { name: "@category", value: category },
        ]
      : [{ name: "@docType", value: MATERIAL_DOC_TYPE }]

  const where =
    category != null
      ? "c.docType = @docType AND c.category = @category"
      : "c.docType = @docType"

  try {
    const { resources } = await container.items
      .query<CosmosMaterialDoc>({
        query: `SELECT * FROM c WHERE ${where}`,
        parameters: baseParams,
      })
      .fetchAll()
    return resources
      .map((doc) => normalizeMaterialItem(doc))
      .sort(compareMaterialsBySortOrder)
  } catch (error) {
    logCosmosError("cosmosGetMaterials", error)
    throw error
  }
}

function compareMaterialsBySortOrder(a: MaterialItem, b: MaterialItem): number {
  const ao = a.sortOrder ?? 0
  const bo = b.sortOrder ?? 0
  if (ao !== bo) return ao - bo
  return a.name.localeCompare(b.name, "de")
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
