import { laserMaterials } from "@/lib/dripforge/data"
import { createMaterialTypeId } from "@/lib/admin/material-stats-types"
import type { LaserMaterial } from "@/lib/dripforge/types"

/** Laser-Materialart inkl. Storefront-/Marketing-Felder. */
export type LaserMaterialTypeDefinition = {
  id: string
  name: string
  isActive: boolean
  sortOrder: number
  description: string
  /** Untertypen, z. B. Sperrholz, MDF, Acryl klar */
  types: string[]
  applications: string[]
  icon: string
  iconBg: string
  iconColor: string
  canEngrave: boolean
  canCut: boolean
  maxThickness: string | null
  imageUrl: string | null
}

function fromCatalog(material: LaserMaterial, index: number): LaserMaterialTypeDefinition {
  return {
    id: material.id,
    name: material.name,
    isActive: true,
    sortOrder: index,
    description: material.description,
    types: [...material.types],
    applications: [...material.applications],
    icon: material.icon,
    iconBg: material.iconBg,
    iconColor: material.iconColor,
    canEngrave: material.canEngrave,
    canCut: material.canCut,
    maxThickness: material.maxThickness,
    imageUrl: null,
  }
}

export function buildDefaultLaserMaterialTypes(): LaserMaterialTypeDefinition[] {
  return laserMaterials.map((material, index) => fromCatalog(material, index))
}

function parseStringList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return fallback
}

export function normalizeLaserMaterialTypeDefinition(
  input: Partial<LaserMaterialTypeDefinition> & Record<string, unknown>,
  existing?: LaserMaterialTypeDefinition
): LaserMaterialTypeDefinition {
  const name =
    String(input.name ?? existing?.name ?? "Neues Lasermaterial").trim() ||
    "Neues Lasermaterial"
  const rawId = String(input.id ?? existing?.id ?? "").trim()
  const id = rawId || createMaterialTypeId(name)
  const sortRaw = Number(input.sortOrder ?? existing?.sortOrder ?? 0)
  const sortOrder = Number.isFinite(sortRaw) ? Math.max(0, Math.round(sortRaw)) : 0
  const catalogDefault = laserMaterials.find((m) => m.id === id)

  return {
    id,
    name,
    isActive:
      input.isActive !== undefined
        ? Boolean(input.isActive)
        : existing?.isActive !== false,
    sortOrder,
    description:
      typeof input.description === "string"
        ? input.description
        : existing?.description ?? catalogDefault?.description ?? "",
    types: parseStringList(
      input.types,
      existing?.types ?? catalogDefault?.types ?? []
    ),
    applications: parseStringList(
      input.applications,
      existing?.applications ?? catalogDefault?.applications ?? []
    ),
    icon:
      typeof input.icon === "string" && input.icon.trim()
        ? input.icon.trim()
        : existing?.icon ?? catalogDefault?.icon ?? "◻️",
    iconBg:
      typeof input.iconBg === "string" && input.iconBg.trim()
        ? input.iconBg.trim()
        : existing?.iconBg ?? catalogDefault?.iconBg ?? "bg-primary/20",
    iconColor:
      typeof input.iconColor === "string" && input.iconColor.trim()
        ? input.iconColor.trim()
        : existing?.iconColor ?? catalogDefault?.iconColor ?? "text-primary",
    canEngrave:
      input.canEngrave !== undefined
        ? Boolean(input.canEngrave)
        : existing?.canEngrave ?? catalogDefault?.canEngrave ?? true,
    canCut:
      input.canCut !== undefined
        ? Boolean(input.canCut)
        : existing?.canCut ?? catalogDefault?.canCut ?? true,
    maxThickness:
      input.maxThickness === null
        ? null
        : typeof input.maxThickness === "string"
          ? input.maxThickness.trim() || null
          : existing?.maxThickness ?? catalogDefault?.maxThickness ?? null,
    imageUrl:
      typeof input.imageUrl === "string" && input.imageUrl.trim()
        ? input.imageUrl.trim()
        : existing?.imageUrl ?? null,
  }
}

export function mergeLaserMaterialTypes(
  stored: LaserMaterialTypeDefinition[] | null | undefined
): LaserMaterialTypeDefinition[] {
  // Bestehende Daten nie mit Katalog-Defaults vermischen — verhindert
  // Wiederauferstehung gelöschter Typen bei Restart/Deploy.
  if (Array.isArray(stored)) {
    return stored
      .map((raw) =>
        normalizeLaserMaterialTypeDefinition(
          raw as Partial<LaserMaterialTypeDefinition> & Record<string, unknown>
        )
      )
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")
      )
  }

  return buildDefaultLaserMaterialTypes()
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
    description: "",
    types: [],
    applications: [],
    icon: "◻️",
    iconBg: "bg-primary/20",
    iconColor: "text-primary",
    canEngrave: true,
    canCut: true,
    maxThickness: null,
    imageUrl: null,
  }
}

export function getActiveLaserMaterialTypes(
  types: LaserMaterialTypeDefinition[]
): LaserMaterialTypeDefinition[] {
  return types.filter((type) => type.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Mappt Admin-Typen auf Storefront-LaserMaterial. */
export function laserTypeToStorefrontMaterial(
  type: LaserMaterialTypeDefinition
): LaserMaterial {
  return {
    id: type.id as LaserMaterial["id"],
    name: type.name,
    icon: type.icon,
    iconBg: type.iconBg,
    iconColor: type.iconColor,
    description: type.description,
    types: type.types.length ? type.types : ["Standard"],
    canEngrave: type.canEngrave,
    canCut: type.canCut,
    maxThickness: type.maxThickness,
    applications: type.applications,
  }
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
