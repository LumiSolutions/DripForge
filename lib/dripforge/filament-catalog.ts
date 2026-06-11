import { materials3D } from "@/lib/dripforge/data"
import type { AdminFilament, FilamentMaterialType } from "@/lib/admin/filament-types"
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
        strength: Math.round((material.strength ?? 60) / 20) || 3,
        flexibility: Math.round((material.flexibility ?? 30) / 20) || 2,
        heatResistance: Math.round((material.heatResistance ?? 40) / 20) || 2,
        surfaceFinish: "matt",
        priceSurchargeChf: 0,
        updatedAt: new Date().toISOString(),
      })
    }
  }
  return filaments
}

export function filamentToColor(filament: AdminFilament): FilamentColor {
  return {
    id: filament.id,
    name: filament.colorName,
    hex: filament.colorHex,
    inStock: filament.inStock,
    image: null,
    printedExample: null,
    manufacturer: filament.manufacturer,
    displayName: [filament.manufacturer, filament.name].filter(Boolean).join(" ").trim(),
    strength: filament.strength,
    flexibility: filament.flexibility,
    heatResistance: filament.heatResistance,
    surfaceFinish: filament.surfaceFinish,
    priceSurchargeChf: filament.priceSurchargeChf,
  }
}

export function groupFilamentsForConfigurator(
  filaments: AdminFilament[]
): FilamentMaterial[] {
  const groups = new Map<FilamentMaterialType, AdminFilament[]>()

  for (const filament of filaments) {
    const list = groups.get(filament.materialType) ?? []
    list.push(filament)
    groups.set(filament.materialType, list)
  }

  return TYPE_ORDER.filter((type) => groups.has(type)).map((type) => ({
    id: type.toLowerCase(),
    name: type,
    colors: (groups.get(type) ?? []).map(filamentToColor),
  }))
}

export function legacyMaterialsFallback(): FilamentMaterial[] {
  return materials3D.map((material) => ({
    id: material.id,
    name: material.name,
    colors: material.colors.map((color) => ({
      id: color.id,
      name: color.name,
      hex: color.hex,
      inStock: color.inStock,
      image: color.image,
      printedExample: color.printedExample ?? null,
    })),
  }))
}
