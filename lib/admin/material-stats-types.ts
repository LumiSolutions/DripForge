import { materials3D } from "@/lib/dripforge/data"
import {
  FILAMENT_MATERIAL_TYPES,
  FILAMENT_SURFACE_FINISHES,
  clampStat,
  type FilamentSurfaceFinish,
} from "@/lib/admin/filament-types"

export const MATERIAL_STATS_DOC_TYPE = "material-stats"
export const MATERIAL_STATS_DOC_ID = "material-stats"

export type MaterialCategoryStat = {
  strength: number
  flexibility: number
  heatResistance: number
  appearance: number
  easeOfUse: number
  surfaceFinish: FilamentSurfaceFinish
  vorteile: string[]
  hinweise: string[]
  idealFuer?: string
  /** Kurzbeschreibung der Materialzusammensetzung (Admin / Shop-Info) */
  compositionDescription?: string
}

export type MaterialTypeDefinition = MaterialCategoryStat & {
  /** Stabiler Slug, z. B. "pla", "petg-cf" */
  id: string
  /** Anzeigename, z. B. "PLA", "PETG-CF" */
  name: string
  isActive: boolean
  /** Manuelle Homepage-Reihenfolge (kleiner = weiter oben) */
  sortOrder: number
}

/** @deprecated Legacy-Map — nutze MaterialTypeDefinition[] */
export type MaterialStatsMap = Record<string, MaterialCategoryStat & Partial<Pick<MaterialTypeDefinition, "isActive" | "sortOrder" | "name">>>

const LEGACY_PERCENT: Partial<
  Record<string, Pick<MaterialCategoryStat, "strength" | "flexibility" | "heatResistance" | "easeOfUse">>
> = {
  PLA: { strength: 60, flexibility: 30, heatResistance: 40, easeOfUse: 95 },
  PETG: { strength: 75, flexibility: 50, heatResistance: 70, easeOfUse: 80 },
  ABS: { strength: 80, flexibility: 35, heatResistance: 80, easeOfUse: 65 },
  ASA: { strength: 85, flexibility: 40, heatResistance: 85, easeOfUse: 60 },
  TPU: { strength: 50, flexibility: 90, heatResistance: 50, easeOfUse: 70 },
  Nylon: { strength: 85, flexibility: 60, heatResistance: 90, easeOfUse: 55 },
}

const DEFAULT_COMPOSITION_DESCRIPTIONS: Partial<Record<string, string>> = {
  PLA: "Besteht aus biokompatibler Polymilchsäure, die aus nachwachsenden Rohstoffen wie Maisstärke oder Zuckerrohr gewonnen wird.",
  PETG: "Ein mit Glykol modifiziertes Polyethylenterephthalat, bekannt für hohe Robustheit und chemische Beständigkeit.",
  ABS: "Ein synthetisches Terpolymer, extrem schlagfest und hitzebeständig, benötigt jedoch einen geschlossenen Bauraum.",
}

function percentToRating(percent: number): number {
  return clampStat(Math.round(percent / 20), 3)
}

/** Textbereich „eine Zeile pro Punkt“ → string[] (auch wenn schon Array). */
export function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean)
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export function createMaterialTypeId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return slug || `type-${Date.now().toString(36)}`
}

export function normalizeMaterialTypeKey(key: string): string {
  const trimmed = key.trim()
  if (!trimmed) return "pla"
  if (trimmed.toLowerCase() === "nylon") return "nylon"
  return trimmed.toLowerCase()
}

function defaultStatFields(): MaterialCategoryStat {
  return {
    strength: 3,
    flexibility: 3,
    heatResistance: 3,
    appearance: 3,
    easeOfUse: 75,
    surfaceFinish: "matt",
    vorteile: [],
    hinweise: [],
    idealFuer: undefined,
    compositionDescription: undefined,
  }
}

function defaultStatForLegacyName(name: string): MaterialCategoryStat {
  const legacyMaterial = materials3D.find(
    (material) => material.id.toLowerCase() === name.toLowerCase() || material.name.toUpperCase() === name.toUpperCase()
  )
  const legacy = LEGACY_PERCENT[name] ?? LEGACY_PERCENT[name.toUpperCase()]
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
    compositionDescription:
      DEFAULT_COMPOSITION_DESCRIPTIONS[name.toUpperCase()] ??
      DEFAULT_COMPOSITION_DESCRIPTIONS[name] ??
      undefined,
  }
}

export function buildDefaultMaterialTypes(): MaterialTypeDefinition[] {
  return FILAMENT_MATERIAL_TYPES.map((name, index) => ({
    id: normalizeMaterialTypeKey(name),
    name,
    isActive: true,
    sortOrder: index,
    ...defaultStatForLegacyName(name),
  }))
}

export function ratingToPercent(rating: number): number {
  return Math.min(100, Math.max(0, clampStat(rating) * 20))
}

export function normalizeMaterialCategoryStat(
  input: Partial<MaterialCategoryStat> | undefined,
  fallbackName = "PLA"
): MaterialCategoryStat {
  const fallback = defaultStatForLegacyName(fallbackName)
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
    vorteile:
      input?.vorteile !== undefined ? toStringList(input.vorteile) : fallback.vorteile,
    hinweise:
      input?.hinweise !== undefined ? toStringList(input.hinweise) : fallback.hinweise,
    idealFuer: String(input?.idealFuer ?? "").trim() || fallback.idealFuer,
    compositionDescription:
      String(input?.compositionDescription ?? "").trim() ||
      fallback.compositionDescription ||
      DEFAULT_COMPOSITION_DESCRIPTIONS[fallbackName.toUpperCase()] ||
      undefined,
  }
}

export function normalizeMaterialTypeDefinition(
  input: Partial<MaterialTypeDefinition>,
  existing?: MaterialTypeDefinition
): MaterialTypeDefinition {
  const name =
    String(input.name ?? existing?.name ?? "Neues Material").trim() ||
    "Neues Material"
  const rawId = String(input.id ?? existing?.id ?? "").trim()
  const id = rawId || createMaterialTypeId(name)
  const stats = normalizeMaterialCategoryStat(input, name)

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
    ...stats,
  }
}

export function migrateLegacyCategoriesToTypes(
  categories: Partial<Record<string, Partial<MaterialCategoryStat>>> | null | undefined
): MaterialTypeDefinition[] {
  // Keine Legacy-Daten → Defaults nur für Erstbefüllung
  if (!categories || Object.keys(categories).length === 0) {
    return buildDefaultMaterialTypes()
  }

  // Vorhandene Legacy-Keys nur migrieren — keine fehlenden Katalog-Defaults ergänzen
  const defaultsById = new Map(
    buildDefaultMaterialTypes().map((type) => [type.id, type])
  )
  const byId = new Map<string, MaterialTypeDefinition>()

  for (const [key, stat] of Object.entries(categories)) {
    const id = normalizeMaterialTypeKey(key)
    const catalog = defaultsById.get(id)
    const name =
      catalog?.name ??
      FILAMENT_MATERIAL_TYPES.find((t) => normalizeMaterialTypeKey(t) === id) ??
      key.toUpperCase()
    const normalizedStats = normalizeMaterialCategoryStat(stat, name)
    byId.set(id, {
      id,
      name,
      isActive: catalog?.isActive !== false,
      sortOrder: catalog?.sortOrder ?? byId.size,
      ...normalizedStats,
    })
  }

  return Array.from(byId.values()).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function mergeMaterialTypes(
  stored:
    | MaterialTypeDefinition[]
    | Partial<Record<string, Partial<MaterialCategoryStat>>>
    | null
    | undefined
): MaterialTypeDefinition[] {
  // Bestehende Arrays unverändert (nur normalisiert) zurückgeben — keine
  // Default-Typen wieder einmischen, sonst gehen Admin-Löschungen bei Deploy verloren.
  if (Array.isArray(stored)) {
    return stored
      .map((raw) => normalizeMaterialTypeDefinition(raw))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  // Legacy-Map / fehlendes Dokument: einmalig Defaults bzw. Migration
  if (stored == null) return buildDefaultMaterialTypes()
  return migrateLegacyCategoriesToTypes(stored)
}

export function sanitizeMaterialTypesInput(
  input: MaterialTypeDefinition[]
): MaterialTypeDefinition[] {
  const seen = new Set<string>()
  return input
    .map((raw, index) => {
      try {
        const name = String(raw?.name ?? "").trim() || "Neues Material"
        const rawId = String(raw?.id ?? "").trim()
        const id =
          rawId.startsWith("type-") && name !== "Neues Material"
            ? createMaterialTypeId(name)
            : rawId || createMaterialTypeId(name)
        return normalizeMaterialTypeDefinition(
          {
            ...raw,
            id,
            name,
            sortOrder: Number(raw?.sortOrder ?? index) || index,
            strength: Number(raw?.strength),
            flexibility: Number(raw?.flexibility),
            heatResistance: Number(raw?.heatResistance),
            appearance: Number(raw?.appearance),
            easeOfUse: Number(raw?.easeOfUse),
            vorteile: toStringList(raw?.vorteile),
            hinweise: toStringList(raw?.hinweise),
          },
          undefined
        )
      } catch (error) {
        console.error(
          "sanitizeMaterialTypesInput: Eintrag fehlgeschlagen.",
          { index, id: raw?.id, name: raw?.name },
          error
        )
        throw new Error(
          `Material-Art Zeile ${index + 1} (${raw?.name || raw?.id || "?"}) ungültig: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    })
    .filter((type) => {
      if (seen.has(type.id)) return false
      seen.add(type.id)
      return true
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** @deprecated Nutze mergeMaterialTypes */
export function mergeMaterialStats(
  stored: Partial<Record<string, Partial<MaterialCategoryStat>>> | null | undefined
): MaterialStatsMap {
  return typesToLegacyMap(mergeMaterialTypes(stored))
}

/** @deprecated */
export function buildDefaultMaterialStats(): MaterialStatsMap {
  return typesToLegacyMap(buildDefaultMaterialTypes())
}

/** @deprecated */
export function sanitizeMaterialStatsInput(
  input: Partial<Record<string, Partial<MaterialCategoryStat>>>
): MaterialStatsMap {
  return typesToLegacyMap(mergeMaterialTypes(input))
}

export function typesToLegacyMap(types: MaterialTypeDefinition[]): MaterialStatsMap {
  const map: MaterialStatsMap = {}
  for (const type of types) {
    const { id, name, isActive, sortOrder, ...stats } = type
    const entry = { ...stats, isActive, sortOrder, name }
    map[id] = entry
    map[name] = entry
    map[name.toUpperCase()] = entry
  }
  return map
}

export function getActiveMaterialTypes(
  types: MaterialTypeDefinition[]
): MaterialTypeDefinition[] {
  return types.filter((type) => type.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function findMaterialType(
  types: MaterialTypeDefinition[],
  ref: string | undefined
): MaterialTypeDefinition | undefined {
  if (!ref?.trim()) return undefined
  const normalized = normalizeMaterialTypeKey(ref)
  const upper = ref.trim().toUpperCase()
  return types.find(
    (type) =>
      type.id === normalized ||
      type.id === ref ||
      type.name.toLowerCase() === normalized ||
      type.name.toUpperCase() === upper
  )
}

export function materialTypeMatchesRef(
  materialTypeRef: string | undefined,
  type: MaterialTypeDefinition
): boolean {
  if (!materialTypeRef?.trim()) return false
  const found = findMaterialType([type], materialTypeRef)
  return found?.id === type.id
}

export type MaterialTypeSortMode = "manual" | "name-asc"

export function sortMaterialTypes(
  types: MaterialTypeDefinition[],
  mode: MaterialTypeSortMode
): MaterialTypeDefinition[] {
  const copy = [...types]
  if (mode === "name-asc") {
    return copy.sort((a, b) => a.name.localeCompare(b.name, "de"))
  }
  return copy.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"))
}

export function createEmptyMaterialType(sortOrder: number): MaterialTypeDefinition {
  return {
    id: createMaterialTypeId(`type-${Date.now()}`),
    name: "",
    isActive: true,
    sortOrder,
    ...defaultStatFields(),
  }
}
