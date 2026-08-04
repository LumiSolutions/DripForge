export type SavedDeliveryAddress = {
  id: string
  label: string
  street: string
  zip: string
  city: string
  isDefault?: boolean
}

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
  deliveryStreet?: string
  deliveryZip?: string
  deliveryCity?: string
  deliverySameAsBilling?: boolean
  /** Mehrere Lieferadressen (Primäradresse via isDefault) */
  deliveryAddresses?: SavedDeliveryAddress[]
  /** Verknüpfung zum CRM (falls bereits Bestellungen) */
  kundennummer?: string
  /** Zugeordnete Kundenkategorie (Rabatt/Versand); Konfig in AdminSettings. */
  customerCategoryId?: string | null
  /** Portal-Kontostatus (Soft Delete) */
  status?: import("@/lib/konto/account-status").CustomerAccountStatus
  /** Zeitpunkt der Kontolöschung */
  deletedAt?: string | null
  /** KI-Generierungs-Credits (Loyalty / KI) */
  aiCredits?: number
  aiCreditGrants?: Record<string, number>
  /** Treuepunkte (Einlösewert konfigurierbar im Admin) */
  loyaltyPoints?: number
  /** Idempotente Gutschriften/Abbuchungen (Ref → Punkte) */
  loyaltyPointGrants?: Record<string, number>
  /** Gutschrift-Chargen mit Ablauf (FIFO-Einlösung) */
  loyaltyPointLots?: import("@/lib/konto/loyalty-points-config").LoyaltyPointLot[]
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
  /** Vorschau-URL oder Data-URL (später Azure Blob) */
  previewUrl?: string | null
  /** Gespeicherte Konfiguration für Nachbestellung */
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CustomerSessionPayload = {
  email: string
  exp: number
}
