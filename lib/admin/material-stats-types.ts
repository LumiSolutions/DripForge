import { materials3D } from "@/lib/dripforge/data"
import {
  FILAMENT_MATERIAL_TYPES,
  FILAMENT_SURFACE_FINISHES,
  clampStat,
  type FilamentMaterialType,
  type FilamentSurfaceFinish,
} from "@/lib/admin/filament-types"

export const MATERIAL_STATS_DOC_TYPE = "material-stats"
export const MATERIAL_STATS_DOC_ID = "material-stats"

export type MaterialCategoryStat = {
  strength: number
  flexibility: number
  heatResistance: number
  /** Optik (1–5) */
  appearance: number
  easeOfUse: number
  surfaceFinish: FilamentSurfaceFinish
  vorteile: string[]
  hinweise: string[]
  idealFuer?: string
}

export type MaterialStatsMap = Record<FilamentMaterialType, MaterialCategoryStat>

const LEGACY_PERCENT: Partial<
  Record<
    FilamentMaterialType,
    Pick<MaterialCategoryStat, "strength" | "flexibility" | "heatResistance" | "easeOfUse">
  >
> = {
  PLA: { strength: 60, flexibility: 30, heatResistance: 40, easeOfUse: 95 },
  PETG: { strength: 75, flexibility: 50, heatResistance: 70, easeOfUse: 80 },
  ABS: { strength: 80, flexibility: 35, heatResistance: 80, easeOfUse: 65 },
  ASA: { strength: 85, flexibility: 40, heatResistance: 85, easeOfUse: 60 },
  TPU: { strength: 50, flexibility: 90, heatResistance: 50, easeOfUse: 70 },
  Nylon: { strength: 85, flexibility: 60, heatResistance: 90, easeOfUse: 55 },
}

function percentToRating(percent: number): number {
  return clampStat(Math.round(percent / 20), 3)
}

function legacyIdToType(id: string): FilamentMaterialType {
  const upper = id.toUpperCase()
  if (FILAMENT_MATERIAL_TYPES.includes(upper as FilamentMaterialType)) {
    return upper as FilamentMaterialType
  }
  return "PLA"
}

function defaultStatForType(type: FilamentMaterialType): MaterialCategoryStat {
  const legacyMaterial = materials3D.find(
    (material) => legacyIdToType(material.id) === type
  )
  const legacy = LEGACY_PERCENT[type]
  const strengthPct = legacyMaterial?.strength ?? legacy?.strength ?? 60
  const flexibilityPct = legacyMaterial?.flexibility ?? legacy?.flexibility ?? 30
  const heatPct = legacyMaterial?.heatResistance ?? legacy?.heatResistance ?? 40
  const easeOfUse = legacyMaterial?.easeOfUse ?? legacy?.easeOfUse ?? 75

  return {
    strength: percentToRating(strengthPct),
    flexibility: percentToRating(flexibilityPct),
    heatResistance: percentToRating(heatPct),
    appearance: 3,
    easeOfUse: Math.min(100, Math.max(0, Math.round(easeOfUse))),
    surfaceFinish: "matt",
    vorteile: [],
    hinweise: [],
    idealFuer: undefined,
  }
}

export function buildDefaultMaterialStats(): MaterialStatsMap {
  return FILAMENT_MATERIAL_TYPES.reduce((acc, type) => {
    acc[type] = defaultStatForType(type)
    return acc
  }, {} as MaterialStatsMap)
}

export function ratingToPercent(rating: number): number {
  return Math.min(100, Math.max(0, clampStat(rating) * 20))
}

export function normalizeMaterialCategoryStat(
  input: Partial<MaterialCategoryStat> | undefined,
  type: FilamentMaterialType
): MaterialCategoryStat {
  const fallback = defaultStatForType(type)
  const surfaceFinish = FILAMENT_SURFACE_FINISHES.includes(
    input?.surfaceFinish as FilamentSurfaceFinish
  )
    ? (input!.surfaceFinish as FilamentSurfaceFinish)
    : fallback.surfaceFinish

  const easeRaw = Number(input?.easeOfUse ?? fallback.easeOfUse)
  const easeOfUse = Number.isFinite(easeRaw)
    ? Math.min(100, Math.max(0, Math.round(easeRaw)))
    : fallback.easeOfUse

  return {
    strength: clampStat(input?.strength ?? fallback.strength),
    flexibility: clampStat(input?.flexibility ?? fallback.flexibility),
    heatResistance: clampStat(input?.heatResistance ?? fallback.heatResistance),
    appearance: clampStat(input?.appearance ?? fallback.appearance),
    easeOfUse,
    surfaceFinish,
    vorteile: Array.isArray(input?.vorteile)
      ? input.vorteile.map((s) => String(s).trim()).filter(Boolean)
      : fallback.vorteile,
    hinweise: Array.isArray(input?.hinweise)
      ? input.hinweise.map((s) => String(s).trim()).filter(Boolean)
      : fallback.hinweise,
    idealFuer: input?.idealFuer?.trim() || fallback.idealFuer,
  }
}

export function mergeMaterialStats(
  stored: Partial<Record<FilamentMaterialType, Partial<MaterialCategoryStat>>> | null | undefined
): MaterialStatsMap {
  const defaults = buildDefaultMaterialStats()
  const merged = { ...defaults }

  for (const type of FILAMENT_MATERIAL_TYPES) {
    merged[type] = normalizeMaterialCategoryStat(stored?.[type], type)
  }

  return merged
}

export function sanitizeMaterialStatsInput(
  input: Partial<Record<FilamentMaterialType, Partial<MaterialCategoryStat>>>
): MaterialStatsMap {
  return mergeMaterialStats(input)
}
