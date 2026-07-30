/** Kern-IDs + freie Slugs aus dem Rohmaterial-Lager (z. B. edelstahl, custom-slug). */
export type LaserMaterialId = string

export type LaserMaterial = {
  id: LaserMaterialId
  name: string
  icon: string
  iconBg: string
  iconColor: string
  description: string
  types: string[]
  canEngrave: boolean
  canCut: boolean
  maxThickness: string | null
  applications: string[]
}

/** Feste Liefermasse (Länge × Breite × Höhe) in mm */
export type ProductDimensionsMm = {
  length: number
  width: number
  height: number
}

export type Product = {
  id: string
  name: string
  description: string
  price: number
  originalPrice: number | null
  type: "3d" | "laser"
  sale: boolean
  /** Unrabattierter Referenzpreis (Admin) */
  basisPreis?: number
  /** Gesamte Selbstkosten / EK für Margenkalkulation (nur Admin) */
  purchasePriceChf?: number
  /** Zusätzliche Basiskosten (Strom, Verschleiss, Verpackung) in CHF */
  additionalBaseCostChf?: number
  /** Rabatt-Art im Sale */
  saleRabattTyp?: "percent" | "fixed"
  /** Rabatt-Wert (% oder CHF) */
  saleRabattWert?: number
  laserMaterialId?: LaserMaterialId
  /** GLB/GLTF-URL aus dem Admin-Portal */
  modelUrl?: string
  /** Produktfotos für die Galerie (Admin-Portal) */
  images?: string[]
  /** Feste Abmessungen — nicht durch den Kunden veränderbar */
  dimensionsMm?: ProductDimensionsMm
  /** Volumen (Standard: cm³) */
  volumen?: number
  volumenEinheit?: "cm3" | "mm3"
  /** Gewicht in Gramm */
  gewicht?: number
  /** Varianten-Stichworte (Admin: kommagetrennt, z. B. "Echtleder Braun, Echtleder Schwarz") */
  varianten?: string[]
  /** Verknüpfung zu Rohmaterialien (Lagerverwaltung) */
  materialLinks?: import("@/lib/admin/material-types").ProductMaterialLink[]
  /** Sichtbarkeit im Shop (false = ausgeblendet) */
  istAktiv?: boolean
  /** Fallback für Startseite «Unsere Top Produkte» bei zu wenigen Verkäufen */
  isTopProduct?: boolean
  /** Produkt-Galerie (Admin) */
  galerieBilder?: string[]
  /** Hintergrund für Laser-Individualisierung im Shop */
  individualisierungsBild?: string
  /** Fest verknuepfte 3D-Basisgeometrie */
  modellDateiUrl?: string
  /** Erstellungszeitpunkt (Admin / Cosmos) */
  createdAt?: string
  /** Zugewiesene Produkt-Tag-IDs (Shop-Filter) */
  tags?: string[]
}

export type LayoutPosition = {
  x: number
  y: number
  scale?: number
  scaleX?: number
  scaleY?: number
  rotation?: number
}

export type LaserDesignCustomDetails = {
  material: string
  variant: string
  userText: string
  userFont: string
  uploadedImage: string | null
  layoutCoordinates: {
    textPosition: LayoutPosition
    imagePosition: LayoutPosition
  }
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  /** Mengeneinheit für Belege/PDF (z. B. Stk, Std) — optional. */
  unit?: string
  /**
   * Freitext-Beschreibung (Beleg-Feld «Details») — wird im PDF
   * unter dem Positionsnamen gerendert.
   */
  description?: string
  type: "3d" | "laser"
  /** Visueller Snapshot der Live-Vorschau (PNG Base64) für die Admin-Bestellübersicht */
  leitbild?: string
  /**
   * Kombiniertes Mockup (Laser: Produkt-Hintergrund + Overlay) als PNG Base64.
   * Wird beim Bestellen als previewMockupUrl persistiert.
   */
  previewMockup?: string
  customDetails?: {
    fileName?: string
    /** Azure-/CDN-URL zur hochgeladenen 3D-Datei (falls vorhanden) */
    fileUrl?: string | null
    modelUrl?: string | null
    filament?: string
    color?: string
    dimensions?: string
    scale?: string
    colorWishes?: string
    colorReferenceImage?: string | null
    colorReferenceImageName?: string | null
    hasEmbeddedModelColors?: boolean
    material?: string
    materialVariant?: string
    variant?: string
    size?: string
    hasImage?: boolean
    hasText?: boolean
    engravingText?: string
    userText?: string
    userFont?: string
    uploadedImage?: string | null
    layoutCoordinates?: {
      textPosition: LayoutPosition
      imagePosition: LayoutPosition
      /** Multi-Element-Layer aus dem Laser-Konfigurator */
      layers?: Array<{
        id: string
        kind: "text" | "image"
        x: number
        y: number
        scale: number
        scaleX?: number
        scaleY?: number
        rotation: number
        text?: string
        fontId?: string
        src?: string | null
        hasImage?: boolean
      }>
    }
    /** Alle hochgeladenen Logos (Multi-Image); uploadedImage bleibt Primärbild */
    uploadedImages?: string[]
    /** Produkt-Hintergrund für Composite-Mockup (Individualisierungsbild) */
    productBackgroundUrl?: string | null
    /** Kunden sendet eigenes Produkt zur Verarbeitung (Personalisierte Laserkreation) */
    isCustomerInbound?: boolean
    /** @deprecated Alias — nutze isCustomerInbound */
    customerShipping?: boolean
  }
}

export type FilamentColor = {
  id: string
  name: string
  hex: string
  inStock: boolean
  image: string | null
  printedExample?: string | null
  manufacturer?: string
  displayName?: string
  strength?: number
  flexibility?: number
  heatResistance?: number
  surfaceFinish?: string
  priceSurchargeChf?: number
}

export type FilamentMaterial = {
  id: string
  name: string
  colors: FilamentColor[]
  strength?: number
  flexibility?: number
  heatResistance?: number
  easeOfUse?: number
}

export type ViewId =
  | "home"
  | "3d-druck"
  | "laser"
  | "shop"
  | "kontakt"
  | "faq"
  | "impressum"
  | "agb"
  | "individual-3d"
  | "individual-laser"
  | "ai-konfigurator"
  | "warenkorb"
  | "checkout"
