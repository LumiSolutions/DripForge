import { materials3D } from "@/lib/dripforge/data"
import type { AdminFilament, FilamentMaterialType } from "@/lib/admin/filament-types"
import {
  buildDefaultMaterialStats,
  type MaterialCategoryStat,
  type MaterialStatsMap,
} from "@/lib/admin/material-stats-types"
import type { FilamentColor, FilamentMaterial } from "@/lib/dripforge/types"

const TYPE_ORDER: FilamentMaterialType[] = [
  "PLA",
  "PETG",
  "ABS",
  "ASA",
  "TPU",
  "Nylon",
]

function legacyTypeToFilamentType(id: string): FilamentMaterialType {
  const upper = id.toUpperCase()
  if (upper === "PLA") return "PLA"
  if (upper === "PETG") return "PETG"
  if (upper === "ABS") return "ABS"
  if (upper === "ASA") return "ASA"
  if (upper === "TPU") return "TPU"
  if (upper === "NYLON") return "Nylon"
  return "PLA"
}

export function seedFilamentsFromLegacyMaterials(): AdminFilament[] {
  const filaments: AdminFilament[] = []
  for (const material of materials3D) {
    const materialType = legacyTypeToFilamentType(material.id)
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
  statsMap: MaterialStatsMap = buildDefaultMaterialStats()
): FilamentMaterial[] {
  const groups = new Map<FilamentMaterialType, AdminFilament[]>()

  for (const filament of filaments) {
    const list = groups.get(filament.materialType) ?? []
    list.push(filament)
    groups.set(filament.materialType, list)
  }

  return TYPE_ORDER.filter((type) => groups.has(type)).map((type) => {
    const stats = statsMap[type]
    return {
      id: type.toLowerCase(),
      name: type,
      strength: stats.strength,
      flexibility: stats.flexibility,
      heatResistance: stats.heatResistance,
      easeOfUse: stats.easeOfUse,
      colors: (groups.get(type) ?? []).map((filament) => filamentToColor(filament, stats)),
    }
  })
}

export function legacyMaterialsFallback(
  statsMap: MaterialStatsMap = buildDefaultMaterialStats()
): FilamentMaterial[] {
  return materials3D.map((material) => {
    const materialType = legacyTypeToFilamentType(material.id)
    const stats = statsMap[materialType]
    return {
      id: material.id,
      name: material.name,
      strength: stats.strength,
      flexibility: stats.flexibility,
      heatResistance: stats.heatResistance,
      easeOfUse: stats.easeOfUse,
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
          stats
        )
      ),
    }
  })
}
