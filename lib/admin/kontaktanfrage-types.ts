export const KONTAKTANFRAGE_DOC_TYPE = "kontaktanfrage"

export const KONTAKT_INQUIRY_TYPES = ["3d", "laser", "general", "quote"] as const
export type KontaktInquiryType = (typeof KONTAKT_INQUIRY_TYPES)[number]

export const KONTAKT_INQUIRY_LABELS: Record<KontaktInquiryType, string> = {
  "3d": "3D-Druck Anfrage",
  laser: "Lasergravur Anfrage",
  general: "Allgemeine Frage",
  quote: "Offerte anfordern",
}

export type Kontaktanfrage = {
  id: string
  docType: typeof KONTAKTANFRAGE_DOC_TYPE
  name: string
  email: string
  company?: string
  inquiryType: KontaktInquiryType
  subject: string
  message: string
  /** Zusätzliche Formularfelder aus dem CMS-Form-Builder */
  extraFields?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export type CreateKontaktanfrageInput = Omit<
  Kontaktanfrage,
  "id" | "docType" | "createdAt" | "updatedAt"
>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidKontaktEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

export function createKontaktanfrageId(): string {
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `ka-${stamp}-${rand}`
}

export function parseKontaktInquiryType(value: unknown): KontaktInquiryType | null {
  return KONTAKT_INQUIRY_TYPES.includes(value as KontaktInquiryType)
    ? (value as KontaktInquiryType)
    : null
}
