export type CustomerAccount = {
  /** Normalisierte E-Mail (Cosmos-ID) */
  id: string
  email: string
  passwordHash: string
  firstName: string
  lastName: string
  /** Verknuepfung zum CRM (falls bereits Bestellungen) */
  kundennummer?: string
  createdAt: string
  updatedAt: string
}

export type SavedCustomerDesign = {
  id: string
  customerEmail: string
  label: string
  designType: "laser" | "3d" | "other"
  /** Vorschau-URL oder Data-URL (spaeter Azure Blob) */
  previewUrl?: string | null
  /** Gespeicherte Konfiguration fuer Nachbestellung */
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CustomerSessionPayload = {
  email: string
  exp: number
}
