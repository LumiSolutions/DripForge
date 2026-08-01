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
  grösse?: string
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
  /** Filament-Material-Art-ID (Slug) — verknüpft mit Material-Arten; Lasermaterial: Werkstoff-Art */
  materialType?: string
  /** Lasermaterial: Form/Typ z. B. Herz, Rechteck, Anhänger-Form */
  typ?: string
  /** Farbname dieses Lagerartikels (Filament) bzw. Zusatzfarbe */
  farbe?: string
  /** Hersteller-Filamentcode / Farbcode (z. B. Bambu Lab «10100») */
  filamentCode?: string
  /** Dicke/Stärke (Lasermaterial), z. B. «3mm» */
  dicke?: string
  /** Format/Grösse (Lasermaterial), z. B. «A4», «30x30 cm» */
  formatGroesse?: string
  /** Filament-Spule (Shop: linker Bild-Slot) */
  spuleBildUrl?: string
  /** Beispiel-Druck / Farbmuster (Shop: rechter Bild-Slot) */
  printBildUrl?: string
  /** Lasermaterial: Rohzustand (Shop: linker Bild-Slot) */
  materialImageUrl?: string
  /** Lasermaterial: Beispiel Gravur/Schnitt (Shop: rechter Bild-Slot) */
  sampleLaserImageUrl?: string
  stockUnit: MaterialStockUnit
  stockAvailable: number
  stockReserved: number
  bemerkungen?: string
  /** Meldebestand in Gramm (Filament) oder Stück */
  mindestbestand?: number
  /** Einkaufspreis pro Einheit (CHF): pro 1000g-Rolle oder pro Stück */
  purchasePrice?: number
  lieferant?: string
  /**
   * Anzeige-Reihenfolge im Admin & Shop-Konfigurator (niedriger = weiter vorne).
   * Persistiert in Cosmos/Datei — wird nicht bei Deploy zurückgesetzt.
   */
  sortOrder?: number
  /** Optionale Hex-Farbe für die 3D-Live-Vorschau (z. B. #1a1a1a) */
  colorHex?: string
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
  if (material.category === "lasermaterial") {
    const parts = [
      material.typ?.trim(),
      material.materialType?.trim(),
      material.farbe?.trim(),
      material.dicke?.trim(),
      material.formatGroesse?.trim(),
    ].filter(Boolean) as string[]
    return parts.length > 0 ? parts.join(" · ") : null
  }
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

export function resolveMaterialPreviewImage(material: MaterialItem): string | undefined {
  if (material.category === "lasermaterial") {
    return material.materialImageUrl ?? material.sampleLaserImageUrl
  }
  // Filament: nur noch das Beispiel-Druckbild (Fallback auf Legacy-Spulenbild)
  return material.printBildUrl ?? material.spuleBildUrl
}

export function isMaterialLowStock(material: MaterialItem): boolean {
  const min = Math.max(0, Number(material.mindestbestand) || 0)
  if (min <= 0) return false
  const { stockAvailable } = getEffectiveMaterialStock(material)
  return stockAvailable < min
}
