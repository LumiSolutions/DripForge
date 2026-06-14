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

/** @deprecated Nur noch für Legacy-Migration — Bestand liegt auf MaterialItem */
export type MaterialVariant = {
  id: string
  farbe?: string
  farbeBildUrl?: string
  groesse?: string
  dicke?: string
  gewichtGramm?: number
  stockAvailable: number
  stockReserved: number
}

/** Einzelner Lagerbestand (z. B. «Bambu Lab PLA Basic — Black») */
export type MaterialItem = {
  id: string
  docType: typeof MATERIAL_DOC_TYPE
  category: MaterialCategory
  /** Produktlinie / Bezeichnung ohne Farbe */
  name: string
  manufacturer?: string
  /** Filament-Material-Art-ID (Slug) — verknüpft mit Material-Arten */
  materialType?: string
  /** Farbname dieses Lagerartikels */
  farbe?: string
  /** Hersteller-Filamentcode / Farbcode (z. B. Bambu Lab «10100») */
  filamentCode?: string
  /** Filament-Spule (Shop: linker Bild-Slot) */
  spuleBildUrl?: string
  /** Beispiel-Druck / Farbmuster (Shop: rechter Bild-Slot) */
  printBildUrl?: string
  stockUnit: MaterialStockUnit
  stockAvailable: number
  stockReserved: number
  bemerkungen?: string
  /** Meldebestand in Gramm (Filament) oder Stück */
  mindestbestand?: number
  lieferant?: string
  updatedAt: string
}

export type ProductMaterialLink = {
  materialId: string
  /** Verbrauch pro verkaufter Einheit in Gramm */
  consumptionGrams: number
  /** Optional: Produktvariante (Stichwort aus varianten[]) */
  productVariant?: string
}

export type OrderMaterialReservation = {
  materialId: string
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
  const stockAvailable = Math.max(0, material.stockAvailable)
  const stockReserved = Math.max(0, material.stockReserved)
  return { stockAvailable, stockReserved, stockTotal: stockAvailable + stockReserved }
}

export function formatMaterialFarbeDisplay(material: MaterialItem): string | null {
  if (!material.farbe?.trim() && !material.filamentCode?.trim()) return null
  const color = material.farbe?.trim() || "—"
  if (material.filamentCode?.trim()) {
    return `${color} (Code: ${material.filamentCode.trim()})`
  }
  return color
}

export function formatMaterialCardTitle(material: MaterialItem): string {
  const parts = [material.manufacturer, material.name].filter(Boolean)
  return parts.join(" · ") || material.name
}

export function formatMaterialStockLabel(material: MaterialItem): string {
  const parts = [material.manufacturer, material.name, material.farbe].filter(Boolean)
  return parts.join(" — ") || material.name
}

export function isMaterialLowStock(material: MaterialItem): boolean {
  const min = Math.max(0, Number(material.mindestbestand) || 0)
  if (min <= 0) return false
  const { stockAvailable } = getEffectiveMaterialStock(material)
  return stockAvailable < min
}
