export type CustomerAccount = {
  /** Normalisierte E-Mail (Cosmos-ID) */
  id: string
  email: string
  passwordHash: string
  firstName: string
  lastName: string
  street?: string
  zip?: string
  city?: string
  phone?: string
  /** Verknuepfung zum CRM (falls bereits Bestellungen) */
  kundennummer?: string
  /** KI-Generierungs-Credits (Loyalty / KI) */
  aiCredits?: number
  aiCreditGrants?: Record<string, number>
  /** Treuepunkte (1 Punkt = 0.10 CHF) */
  loyaltyPoints?: number
  /** Idempotente Gutschriften/Abbuchungen (Ref → Punkte) */
  loyaltyPointGrants?: Record<string, number>
  /** Letzte Punkt-Transaktionen (Audit) */
  loyaltyPointTransactions?: import("@/lib/konto/loyalty-points-config").LoyaltyPointTransaction[]
  passwordResetTokenHash?: string | null
  passwordResetExpiresAt?: string | null
  createdAt: string
  updatedAt: string
}

export type CustomerProfileInput = {
  firstName: string
  lastName: string
  street: string
  zip: string
  city: string
  phone: string
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
