export type LaserMaterialId = "wood" | "acrylic" | "stone" | "leather"

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
  /** Produktfotos fuer die Galerie (Admin-Portal) */
  images?: string[]
  /** Feste Abmessungen — nicht durch den Kunden veraenderbar */
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
  /** Auf der Startseite unter «Unsere Top Produkte» anzeigen */
  isTopProduct?: boolean
  /** Produkt-Galerie (Admin) */
  galerieBilder?: string[]
  /** Hintergrund fuer Laser-Individualisierung im Shop */
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
  type: "3d" | "laser"
  /** Visueller Snapshot der Live-Vorschau (PNG Base64) fuer die Admin-Bestelluebersicht */
  leitbild?: string
  customDetails?: {
    fileName?: string
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
    }
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
