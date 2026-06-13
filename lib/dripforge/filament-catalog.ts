import { materials3D } from "@/lib/dripforge/data"
import type { AdminFilament } from "@/lib/admin/filament-types"
import {
  buildDefaultMaterialTypes,
  findMaterialType,
  getActiveMaterialTypes,
  normalizeMaterialTypeKey,
  type MaterialCategoryStat,
  type MaterialTypeDefinition,
} from "@/lib/admin/material-stats-types"
import type { FilamentColor, FilamentMaterial } from "@/lib/dripforge/types"

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
  stats: MaterialCategoryStat
): FilamentColor {
  return applyCategoryStats(
    {
      id: filament.id,
      name: filament.colorName,
      hex: filament.colorHex,
      inStock: filament.inStock,
      image: null,
      printedExample: null,
      manufacturer: filament.manufacturer,
      displayName: [filament.manufacturer, filament.name].filter(Boolean).join(" ").trim(),
      priceSurchargeChf: filament.priceSurchargeChf,
    },
    stats
  )
}

export function groupFilamentsForConfigurator(
  filaments: AdminFilament[],
  materialTypes: MaterialTypeDefinition[] = buildDefaultMaterialTypes(),
  options?: { includeInactive?: boolean }
): FilamentMaterial[] {
  const includeInactive = options?.includeInactive ?? false
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
      colors: (groups.get(type.id) ?? []).map((filament) => filamentToColor(filament, type)),
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
