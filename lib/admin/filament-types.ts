import { normalizeMaterialTypeKey } from "@/lib/admin/material-stats-types"

export const FILAMENT_MATERIAL_TYPES = [
  "PLA",
  "PETG",
  "ABS",
  "ASA",
  "TPU",
  "Nylon",
] as const

export type FilamentMaterialType = (typeof FILAMENT_MATERIAL_TYPES)[number]

export const FILAMENT_SURFACE_FINISHES = ["matt", "glänzend", "carbon"] as const

export type FilamentSurfaceFinish = (typeof FILAMENT_SURFACE_FINISHES)[number]

export type AdminFilament = {
  id: string
  /** Material-Art-ID (Slug), z. B. "pla", "petg-cf" */
  materialType: string
  manufacturer: string
  name: string
  colorName: string
  colorHex: string
  inStock: boolean
  priceSurchargeChf: number
  updatedAt?: string
}

export function clampStat(value: unknown, fallback = 3): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(5, Math.max(1, n))
}

export function normalizeAdminFilament(
  input: Partial<AdminFilament> & {
    strength?: unknown
    flexibility?: unknown
    heatResistance?: unknown
    surfaceFinish?: unknown
  },
  existing?: AdminFilament
): AdminFilament {
  const materialType = input.materialType?.trim()
    ? normalizeMaterialTypeKey(input.materialType)
    : existing?.materialType ?? "pla"

  return {
    id: input.id?.trim() || existing?.id || `fil-${Date.now()}`,
    materialType,
    manufacturer: input.manufacturer?.trim() || existing?.manufacturer || "",
    name: input.name?.trim() || existing?.name || "Neues Filament",
    colorName: input.colorName?.trim() || existing?.colorName || "Farbe",
    colorHex: /^#[0-9A-Fa-f]{6}$/.test(input.colorHex ?? "")
      ? input.colorHex!
      : existing?.colorHex ?? "#1a1a1a",
    inStock: input.inStock !== undefined ? Boolean(input.inStock) : existing?.inStock !== false,
    priceSurchargeChf: Math.max(
      0,
      Number(input.priceSurchargeChf ?? existing?.priceSurchargeChf ?? 0) || 0
    ),
    updatedAt: new Date().toISOString(),
  }
}
