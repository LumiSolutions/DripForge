import { laserMaterials } from "@/lib/dripforge/data"
import { createMaterialTypeId } from "@/lib/admin/material-stats-types"

/** Laser-Materialart (ohne Filament-Stats-Felder). */
export type LaserMaterialTypeDefinition = {
  id: string
  name: string
  isActive: boolean
  sortOrder: number
}

export function buildDefaultLaserMaterialTypes(): LaserMaterialTypeDefinition[] {
  return laserMaterials.map((material, index) => ({
    id: material.id,
    name: material.name,
    isActive: true,
    sortOrder: index,
  }))
}

export function normalizeLaserMaterialTypeDefinition(
  input: Partial<LaserMaterialTypeDefinition>,
  existing?: LaserMaterialTypeDefinition
): LaserMaterialTypeDefinition {
  const name =
    String(input.name ?? existing?.name ?? "Neues Lasermaterial").trim() ||
    "Neues Lasermaterial"
  const rawId = String(input.id ?? existing?.id ?? "").trim()
  const id = rawId || createMaterialTypeId(name)
  const sortRaw = Number(input.sortOrder ?? existing?.sortOrder ?? 0)
  const sortOrder = Number.isFinite(sortRaw) ? Math.max(0, Math.round(sortRaw)) : 0

  return {
    id,
    name,
    isActive:
      input.isActive !== undefined
        ? Boolean(input.isActive)
        : existing?.isActive !== false,
    sortOrder,
  }
}

export function mergeLaserMaterialTypes(
  stored: LaserMaterialTypeDefinition[] | null | undefined
): LaserMaterialTypeDefinition[] {
  const defaults = buildDefaultLaserMaterialTypes()
  const byId = new Map(defaults.map((type) => [type.id, { ...type }]))

  if (Array.isArray(stored)) {
    for (const raw of stored) {
      const normalized = normalizeLaserMaterialTypeDefinition(
        raw,
        byId.get(String(raw?.id ?? "").trim())
      )
      byId.set(normalized.id, normalized)
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")
  )
}

export function sanitizeLaserMaterialTypesInput(
  input: LaserMaterialTypeDefinition[]
): LaserMaterialTypeDefinition[] {
  const seen = new Set<string>()
  return input
    .map((raw, index) =>
      normalizeLaserMaterialTypeDefinition(
        {
          ...raw,
          id: String(raw?.id ?? "").trim() || createMaterialTypeId(raw?.name || `laser-${index}`),
          name: String(raw?.name ?? "").trim() || "Neues Lasermaterial",
          sortOrder: Number(raw?.sortOrder ?? index) || index,
          isActive: Boolean(raw?.isActive !== false),
        },
        undefined
      )
    )
    .filter((type) => {
      if (seen.has(type.id)) return false
      seen.add(type.id)
      return true
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"))
}

export function createEmptyLaserMaterialType(
  sortOrder: number
): LaserMaterialTypeDefinition {
  return {
    id: createMaterialTypeId(`laser-${Date.now()}`),
    name: "",
    isActive: true,
    sortOrder,
  }
}

export function getActiveLaserMaterialTypes(
  types: LaserMaterialTypeDefinition[]
): LaserMaterialTypeDefinition[] {
  return types.filter((type) => type.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Zählt Lagereinträge, die zu einer Laser-Materialart gehören. */
export function countStockForLaserMaterialType(
  items: Array<{ category?: string; name?: string; materialType?: string }>,
  type: LaserMaterialTypeDefinition
): number {
  const typeId = type.id.toLowerCase()
  const typeName = type.name.trim().toLowerCase()
  return items.filter((item) => {
    if (item.category && item.category !== "lasermaterial") return false
    const ref = String(item.materialType ?? "").trim().toLowerCase()
    if (ref && (ref === typeId || ref === typeName)) return true
    const name = String(item.name ?? "").trim().toLowerCase()
    return Boolean(name && (name === typeName || name.includes(typeName) || typeName.includes(name)))
  }).length
}
