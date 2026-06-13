export const MATERIAL_DOC_TYPE = "material" as const

/** Gramm pro voller Filament-Rolle (1 kg) */
export const GRAMS_PER_FULL_SPOOL = 1000

export type MaterialCategory = "filament" | "lasermaterial" | "sonstiges"

export const MATERIAL_CATEGORIES: {
  id: MaterialCategory
  label: string
}[] = [
  { id: "filament", label: "Filament" },
  { id: "lasermaterial", label: "Lasermaterial" },
  { id: "sonstiges", label: "Sonstiges" },
]

export type MaterialStockUnit = "gram" | "piece"

/** 4-Punkte-Skala (1–5) für Filament-Detailseiten */
export type MaterialScaleRating = {
  flexibility: number
  strength: number
  heatResistance: number
  appearance: number
}

export type MaterialVariant = {
  id: string
  farbe?: string
  farbeBildUrl?: string
  groesse?: string
  dicke?: string
  /** Metadaten: Gewicht einer Rolle/Einheit in Gramm (z. B. 1000) */
  gewichtGramm?: number
  stockAvailable: number
  stockReserved: number
}

export type MaterialItem = {
  id: string
  docType: typeof MATERIAL_DOC_TYPE
  category: MaterialCategory
  name: string
  manufacturer?: string
  stockUnit: MaterialStockUnit
  /** Bestand ohne Varianten (oder Summe wenn keine Varianten genutzt) */
  stockAvailable: number
  stockReserved: number
  variants: MaterialVariant[]
  bemerkungen?: string
  vorteile?: string[]
  hinweise?: string[]
  idealFuer?: string
  skala?: MaterialScaleRating
  /** Meldebestand in Gramm (Filament) oder Stück */
  mindestbestand?: number
  imageUrl?: string
  lieferant?: string
  updatedAt: string
}

export type ProductMaterialLink = {
  materialId: string
  variantId?: string
  /** Verbrauch pro verkaufter Einheit in Gramm */
  consumptionGrams: number
  /** Optional: Produktvariante (Stichwort aus varianten[]) */
  productVariant?: string
}

export type OrderMaterialReservation = {
  materialId: string
  variantId?: string
  quantity: number
  stockUnit: MaterialStockUnit
}

export type OrderInventoryState = "none" | "reserved" | "consumed" | "released"

export function materialStockTotal(item: Pick<MaterialItem, "stockAvailable" | "stockReserved">): number {
  return Math.max(0, item.stockAvailable) + Math.max(0, item.stockReserved)
}

export function variantStockTotal(v: Pick<MaterialVariant, "stockAvailable" | "stockReserved">): number {
  return Math.max(0, v.stockAvailable) + Math.max(0, v.stockReserved)
}

export function clampScaleRating(value: unknown, fallback = 3): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(5, Math.max(1, Math.round(n)))
}

export function normalizeMaterialScale(input?: Partial<MaterialScaleRating> | null): MaterialScaleRating {
  return {
    flexibility: clampScaleRating(input?.flexibility),
    strength: clampScaleRating(input?.strength),
    heatResistance: clampScaleRating(input?.heatResistance),
    appearance: clampScaleRating(input?.appearance),
  }
}

export function createMaterialVariantId(): string {
  return `var-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function createMaterialId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `mat-${slug || "material"}-${Date.now().toString(36)}`
}

export function getEffectiveMaterialStock(material: MaterialItem): {
  stockAvailable: number
  stockReserved: number
  stockTotal: number
} {
  if (material.variants.length > 0) {
    const stockAvailable = material.variants.reduce(
      (sum, v) => sum + Math.max(0, v.stockAvailable),
      0
    )
    const stockReserved = material.variants.reduce(
      (sum, v) => sum + Math.max(0, v.stockReserved),
      0
    )
    return { stockAvailable, stockReserved, stockTotal: stockAvailable + stockReserved }
  }
  const stockAvailable = Math.max(0, material.stockAvailable)
  const stockReserved = Math.max(0, material.stockReserved)
  return { stockAvailable, stockReserved, stockTotal: stockAvailable + stockReserved }
}

export function createEmptyVariant(): MaterialVariant {
  return {
    id: createMaterialVariantId(),
    stockAvailable: 0,
    stockReserved: 0,
    gewichtGramm: GRAMS_PER_FULL_SPOOL,
  }
}

export function isMaterialLowStock(material: MaterialItem): boolean {
  const min = Math.max(0, Number(material.mindestbestand) || 0)
  if (min <= 0) return false
  const { stockAvailable } = getEffectiveMaterialStock(material)
  return stockAvailable < min
}
