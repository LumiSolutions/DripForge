export const KONTAKTANFRAGE_DOC_TYPE = "kontaktanfrage"

export const KONTAKT_INQUIRY_TYPES = ["3d", "laser", "general", "quote"] as const
export type KontaktInquiryType = (typeof KONTAKT_INQUIRY_TYPES)[number]

export const KONTAKT_INQUIRY_LABELS: Record<KontaktInquiryType, string> = {
  "3d": "3D-Druck Anfrage",
  laser: "Lasergravur Anfrage",
  general: "Allgemeine Frage",
  quote: "Offerte anfordern",
}

export const KONTAKT_STATUS_VALUES = ["offen", "beantwortet", "archiviert"] as const
export type KontaktStatus = (typeof KONTAKT_STATUS_VALUES)[number]

export const KONTAKT_STATUS_LABELS: Record<KontaktStatus, string> = {
  offen: "Offen",
  beantwortet: "Beantwortet",
  archiviert: "Archiviert",
}

/** Ein Eintrag im Nachrichtenverlauf (Thread) einer Kontaktanfrage. */
export type KontaktThreadEntry = {
  id: string
  /** "customer" = Kunde, "admin" = Antwort aus dem Admin */
  role: "customer" | "admin"
  subject?: string
  body: string
  /** ISO-Zeitstempel */
  at: string
}

export type Kontaktanfrage = {
  id: string
  docType: typeof KONTAKTANFRAGE_DOC_TYPE
  name: string
  email: string
  phone?: string
  company?: string
  inquiryType: KontaktInquiryType
  subject: string
  message: string
  status: KontaktStatus
  /** Nachrichtenverlauf (Antworten des Admins, spätere Folgenachrichten). */
  thread?: KontaktThreadEntry[]
  /** Zusätzliche Formularfelder aus dem CMS-Form-Builder */
  extraFields?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export type CreateKontaktanfrageInput = Omit<
  Kontaktanfrage,
  "id" | "docType" | "createdAt" | "updatedAt" | "status"
> & {
  status?: KontaktStatus
}

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

export function normalizeKontaktStatus(value: unknown): KontaktStatus {
  if (
    typeof value === "string" &&
    KONTAKT_STATUS_VALUES.includes(value as KontaktStatus)
  ) {
    return value as KontaktStatus
  }
  return "offen"
}

export function extractKontaktPhone(
  phone: unknown,
  extraFields?: Record<string, string> | null
): string | undefined {
  if (typeof phone === "string" && phone.trim()) return phone.trim().slice(0, 60)
  if (!extraFields) return undefined
  for (const key of [
    "phone",
    "telefon",
    "Telefon",
    "tel",
    "mobile",
    "handy",
    "Handy",
  ]) {
    const value = extraFields[key]
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 60)
  }
  return undefined
}

export function normalizeKontaktanfrage(
  raw: Partial<Kontaktanfrage> & { id?: string }
): Kontaktanfrage | null {
  if (!raw?.id || !raw.name || !raw.email) return null
  const inquiryType = parseKontaktInquiryType(raw.inquiryType) ?? "general"
  const phone = extractKontaktPhone(raw.phone, raw.extraFields)
  return {
    id: String(raw.id),
    docType: KONTAKTANFRAGE_DOC_TYPE,
    name: String(raw.name),
    email: String(raw.email),
    phone,
    company: raw.company?.trim() || undefined,
    inquiryType,
    subject: String(raw.subject ?? ""),
    message: String(raw.message ?? ""),
    status: normalizeKontaktStatus(raw.status),
    thread: Array.isArray(raw.thread)
      ? raw.thread
          .filter(
            (e): e is KontaktThreadEntry =>
              Boolean(e) && typeof e.body === "string"
          )
          .map((e) => ({
            id: String(e.id ?? `msg-${Date.now()}`),
            role: e.role === "admin" ? "admin" : "customer",
            subject: typeof e.subject === "string" ? e.subject : undefined,
            body: String(e.body ?? ""),
            at: typeof e.at === "string" ? e.at : new Date().toISOString(),
          }))
      : undefined,
    extraFields: raw.extraFields,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  }
}
