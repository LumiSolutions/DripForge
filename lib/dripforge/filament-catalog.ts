import { materials3D } from "@/lib/dripforge/data"
import type { AdminFilament } from "@/lib/admin/filament-types"
import type { MaterialItem } from "@/lib/admin/material-types"
import {
  buildDefaultMaterialTypes,
  findMaterialType,
  getActiveMaterialTypes,
  normalizeMaterialTypeKey,
  type MaterialCategoryStat,
  type MaterialTypeDefinition,
} from "@/lib/admin/material-stats-types"
import type { FilamentColor, FilamentMaterial } from "@/lib/dripforge/types"

function normalizeFilamentMatchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export type InventoryColorEnrichment = {
  spuleBildUrl?: string
  printBildUrl?: string
}

/** Öffentlicher Titel ohne Hersteller / internen Filamentcode */
export function formatPublicFilamentDisplayName(
  filament: Pick<AdminFilament, "name" | "colorName">
): string {
  const name = filament.name.trim()
  const color = filament.colorName.trim()
  if (!color) return name
  if (name.toLowerCase().includes(color.toLowerCase())) return name
  return `${name} ${color}`.trim()
}

export function buildInventoryColorEnrichmentMap(
  items: MaterialItem[]
): Map<string, InventoryColorEnrichment> {
  const map = new Map<string, InventoryColorEnrichment>()

  for (const item of items) {
    if (item.category !== "filament") continue
    const spuleBildUrl = item.spuleBildUrl?.trim()
    const printBildUrl = item.printBildUrl?.trim()
    if (!spuleBildUrl && !printBildUrl) continue

    const materialType = normalizeMaterialTypeKey(item.materialType ?? "pla")
    const name = normalizeFilamentMatchKey(item.name)
    const color = normalizeFilamentMatchKey(item.farbe ?? "")
    const manufacturer = normalizeFilamentMatchKey(item.manufacturer ?? "")
    const payload: InventoryColorEnrichment = {
      ...(spuleBildUrl ? { spuleBildUrl } : {}),
      ...(printBildUrl ? { printBildUrl } : {}),
    }

    if (manufacturer) map.set(`${materialType}|${name}|${color}|${manufacturer}`, payload)
    map.set(`${materialType}|${name}|${color}`, payload)
    if (color) map.set(`${materialType}|${color}`, payload)
  }

  return map
}

export function findInventoryColorEnrichment(
  filament: AdminFilament,
  enrichment: Map<string, InventoryColorEnrichment>
): InventoryColorEnrichment | undefined {
  const materialType = normalizeMaterialTypeKey(filament.materialType)
  const name = normalizeFilamentMatchKey(filament.name)
  const color = normalizeFilamentMatchKey(filament.colorName)
  const manufacturer = normalizeFilamentMatchKey(filament.manufacturer)

  return (
    (manufacturer
      ? enrichment.get(`${materialType}|${name}|${color}|${manufacturer}`)
      : undefined) ??
    enrichment.get(`${materialType}|${name}|${color}`) ??
    enrichment.get(`${materialType}|${color}`)
  )
}

function legacyTypeToId(id: string): string {
  return normalizeMaterialTypeKey(id)
}

export function seedFilamentsFromLegacyMaterials(): AdminFilament[] {
  const filaments: AdminFilament[] = []
  for (const material of materials3D) {
    const materialType = legacyTypeToId(material.id)
    for (const color of material.colors) {
      filaments.push({
        id: color.id,
        materialType,
        manufacturer: "Standard",
        name: `${material.name} ${color.name}`,
        colorName: color.name,
        colorHex: color.hex,
        inStock: color.inStock,
        priceSurchargeChf: 0,
        updatedAt: new Date().toISOString(),
      })
    }
  }
  return filaments
}

function applyCategoryStats(
  color: Omit<
    FilamentColor,
    "strength" | "flexibility" | "heatResistance" | "surfaceFinish"
  >,
  stats: MaterialCategoryStat
): FilamentColor {
  return {
    ...color,
    strength: stats.strength,
    flexibility: stats.flexibility,
    heatResistance: stats.heatResistance,
    surfaceFinish: stats.surfaceFinish,
  }
}

export function filamentToColor(
  filament: AdminFilament,
  stats: MaterialCategoryStat,
  inventory?: InventoryColorEnrichment
): FilamentColor {
  const spuleUrl = inventory?.spuleBildUrl?.trim() || null
  const printUrl = inventory?.printBildUrl?.trim() || null

  return applyCategoryStats(
    {
      id: filament.id,
      name: filament.colorName,
      hex: filament.colorHex,
      inStock: filament.inStock,
      image: spuleUrl,
      printedExample: printUrl,
      displayName: formatPublicFilamentDisplayName(filament),
      priceSurchargeChf: filament.priceSurchargeChf,
    },
    stats
  )
}

export function groupFilamentsForConfigurator(
  filaments: AdminFilament[],
  materialTypes: MaterialTypeDefinition[] = buildDefaultMaterialTypes(),
  options?: {
    includeInactive?: boolean
    inventoryEnrichment?: Map<string, InventoryColorEnrichment>
  }
): FilamentMaterial[] {
  const includeInactive = options?.includeInactive ?? false
  const inventoryEnrichment = options?.inventoryEnrichment
  const orderedTypes = includeInactive
    ? [...materialTypes].sort((a, b) => a.sortOrder - b.sortOrder)
    : getActiveMaterialTypes(materialTypes)

  const groups = new Map<string, AdminFilament[]>()

  for (const filament of filaments) {
    const typeDef = findMaterialType(materialTypes, filament.materialType)
    if (!typeDef) continue
    if (!includeInactive && !typeDef.isActive) continue
    const list = groups.get(typeDef.id) ?? []
    list.push(filament)
    groups.set(typeDef.id, list)
  }

  return orderedTypes
    .filter((type) => groups.has(type.id))
    .map((type) => ({
      id: type.id,
      name: type.name,
      strength: type.strength,
      flexibility: type.flexibility,
      heatResistance: type.heatResistance,
      easeOfUse: type.easeOfUse,
      colors: (groups.get(type.id) ?? []).map((filament) =>
        filamentToColor(
          filament,
          type,
          inventoryEnrichment
            ? findInventoryColorEnrichment(filament, inventoryEnrichment)
            : undefined
        )
      ),
    }))
}

export function legacyMaterialsFallback(
  materialTypes: MaterialTypeDefinition[] = buildDefaultMaterialTypes()
): FilamentMaterial[] {
  const activeTypes = getActiveMaterialTypes(materialTypes)
  const result: FilamentMaterial[] = []
  for (const material of materials3D) {
    const materialType = legacyTypeToId(material.id)
    const typeDef = findMaterialType(activeTypes, materialType)
    if (!typeDef) continue
    result.push({
      id: material.id,
      name: material.name,
      strength: typeDef.strength,
      flexibility: typeDef.flexibility,
      heatResistance: typeDef.heatResistance,
      easeOfUse: typeDef.easeOfUse,
      colors: material.colors.map((color) =>
        applyCategoryStats(
          {
            id: color.id,
            name: color.name,
            hex: color.hex,
            inStock: color.inStock,
            image: color.image,
            printedExample: color.printedExample ?? null,
          },
          typeDef
        )
      ),
    })
  }
  return result
}
