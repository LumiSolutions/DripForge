import type { DocumentTemplateType } from "@/lib/documents/document-template-types"
import { resolveBelegVatFields, DEFAULT_BELEG_VAT } from "@/lib/documents/beleg-vat"
import { defaultBelegRevenueAccountCode } from "@/lib/documents/beleg-accounts"

export const BELEG_DOC_TYPE = "business-beleg" as const

export type BelegType = "offerte" | "rechnung" | "lieferschein"

export type OfferteStatus = "entwurf" | "offen" | "angenommen" | "abgelehnt"
export type RechnungStatus = "offen" | "bezahlt" | "storniert" | "gemahnt"
export type LieferscheinStatus = "entwurf" | "bereit" | "versendet"
export type BelegStatus = OfferteStatus | RechnungStatus | LieferscheinStatus

export type BelegAddress = {
  firstName: string
  lastName: string
  email: string
  street: string
  zip: string
  city: string
  country: string
  company?: string
}

/** Vorschläge für Positions-Einheiten (Freitext bleibt erlaubt). */
export const BELEG_UNIT_OPTIONS = ["Stk", "Std", "kWh", "m", "Psch"] as const

export const DEFAULT_BELEG_UNIT = "Stk"

export type BelegPosition = {
  id: string
  name: string
  details?: string
  quantity: number
  /** Mengeneinheit, z. B. Stk, Std, kWh (Freitext erlaubt). */
  unit: string
  unitPrice: number
  /**
   * Ertragskonto (Kontonummer aus dem Buchhaltungs-Kontenplan),
   * z. B. "320001" für spätere automatische Verbuchung.
   */
  accountCode: string
  /** Positionsrabatt in Prozent (0–100). */
  discountPercent: number
  /**
   * Buchhaltungs-Steuercode (z. B. U00, UN81, UR26).
   * Muss mit den Umsatzsteuer-Codes der Buchhaltung übereinstimmen.
   */
  taxCode: string
  /** MwSt.-Satz als Dezimalzahl (z. B. 0.081) — für Journal/Buchhaltung. */
  taxRate: number
  /** MwSt.-Satz als Prozent (z. B. 8.1) — Anzeige / Legacy. */
  taxRatePercent: number
  /** Zeilen-Netto nach Rabatt, ohne MwSt. */
  lineTotal: number
}

export type Beleg = {
  id: string
  type: BelegType
  status: BelegStatus
  kunde: BelegAddress
  lieferAdresse?: BelegAddress
  /**
   * Verknüpfung zur Kundenverwaltung (kundennummer).
   * Wird beim Speichern anhand der E-Mail gesetzt/aktualisiert.
   */
  customerId?: string | null
  positionen: BelegPosition[]
  /** Netto-Zwischensumme (ohne MwSt.). */
  subtotal: number
  /** Summe MwSt. */
  vatTotal: number
  /** Endbetrag inkl. MwSt. */
  total: number
  linkedTo?: string | null
  sourceOrderId?: string | null
  pdfUrl?: string | null
  notes?: string
  createdAt: string
  updatedAt: string
}

export type BelegCosmosDoc = Beleg & {
  docType: typeof BELEG_DOC_TYPE
}

export const BELEG_TYPE_LABELS: Record<BelegType, string> = {
  offerte: "Offerte",
  rechnung: "Rechnung",
  lieferschein: "Lieferschein",
}

export const BELEG_PREFIX: Record<BelegType, string> = {
  offerte: "OF",
  rechnung: "RE",
  lieferschein: "LS",
}

export const OFFERTE_STATUSES: OfferteStatus[] = [
  "entwurf",
  "offen",
  "angenommen",
  "abgelehnt",
]
export const RECHNUNG_STATUSES: RechnungStatus[] = [
  "offen",
  "bezahlt",
  "storniert",
  "gemahnt",
]
export const LIEFERSCHEIN_STATUSES: LieferscheinStatus[] = [
  "entwurf",
  "bereit",
  "versendet",
]

export function belegCosmosId(id: string): string {
  return `${BELEG_DOC_TYPE}:${id}`
}

export function belegTypeToDocumentTemplateType(
  type: BelegType
): DocumentTemplateType {
  if (type === "offerte") return "quote"
  if (type === "lieferschein") return "deliveryNote"
  return "invoice"
}

export function defaultStatusForType(type: BelegType): BelegStatus {
  if (type === "offerte") return "entwurf"
  if (type === "lieferschein") return "bereit"
  return "offen"
}

export function statusesForType(type: BelegType): BelegStatus[] {
  if (type === "offerte") return OFFERTE_STATUSES
  if (type === "lieferschein") return LIEFERSCHEIN_STATUSES
  return RECHNUNG_STATUSES
}

export function roundChf(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

export function computePositionGross(
  quantity: number,
  unitPrice: number
): number {
  return roundChf(Math.max(0, quantity) * Math.max(0, unitPrice))
}

export function clampDiscountPercent(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(100, Math.max(0, n))
}

export function computePositionDiscountAmount(
  quantity: number,
  unitPrice: number,
  discountPercent: number
): number {
  const gross = computePositionGross(quantity, unitPrice)
  const pct = clampDiscountPercent(discountPercent)
  return roundChf(gross * (pct / 100))
}

/**
 * Zeilen-Netto = (Menge * Einzelpreis) * (1 - Rabatt/100)
 */
export function computePositionLineTotal(
  quantity: number,
  unitPrice: number,
  discountPercent = 0
): number {
  const gross = computePositionGross(quantity, unitPrice)
  const discount = computePositionDiscountAmount(
    quantity,
    unitPrice,
    discountPercent
  )
  return roundChf(Math.max(0, gross - discount))
}

export function computeBelegTotals(positionen: BelegPosition[]): {
  subtotal: number
  vatTotal: number
  total: number
} {
  let subtotal = 0
  let vatTotal = 0
  for (const pos of positionen) {
    const line = roundChf(
      pos.lineTotal ||
        computePositionLineTotal(pos.quantity, pos.unitPrice, pos.discountPercent)
    )
    subtotal = roundChf(subtotal + line)
    const rate =
      Number.isFinite(pos.taxRate) && pos.taxRate >= 0
        ? pos.taxRate
        : Math.max(0, Number(pos.taxRatePercent) || 0) / 100
    vatTotal = roundChf(vatTotal + line * rate)
  }
  return {
    subtotal,
    vatTotal,
    total: roundChf(subtotal + vatTotal),
  }
}

export function emptyBelegAddress(): BelegAddress {
  return {
    firstName: "",
    lastName: "",
    email: "",
    street: "",
    zip: "",
    city: "",
    country: "CH",
    company: "",
  }
}

export function normalizeBelegAddress(raw: Partial<BelegAddress> | null | undefined): BelegAddress {
  const base = emptyBelegAddress()
  if (!raw || typeof raw !== "object") return base
  return {
    firstName: String(raw.firstName ?? "").trim(),
    lastName: String(raw.lastName ?? "").trim(),
    email: String(raw.email ?? "").trim(),
    street: String(raw.street ?? "").trim(),
    zip: String(raw.zip ?? "").trim(),
    city: String(raw.city ?? "").trim(),
    country: String(raw.country ?? "CH").trim() || "CH",
    company: String(raw.company ?? "").trim() || undefined,
  }
}

export function normalizeBelegUnit(raw: unknown): string {
  if (raw == null) return DEFAULT_BELEG_UNIT
  const value = String(raw).trim()
  return value || DEFAULT_BELEG_UNIT
}

export function formatBelegQuantityWithUnit(
  quantity: number,
  unit?: string | null
): string {
  const qty = Number.isFinite(quantity) ? String(quantity) : "0"
  const unitLabel = String(unit ?? "").trim()
  return unitLabel ? `${qty} ${unitLabel}` : qty
}

export function normalizeBelegPosition(
  raw: Partial<BelegPosition> & { id?: string; einheit?: string },
  index: number
): BelegPosition {
  const quantity = Math.max(0, Number(raw.quantity) || 0)
  const unitPrice = Math.max(0, Number(raw.unitPrice) || 0)
  const discountPercent = clampDiscountPercent(raw.discountPercent)
  const accountCode =
    String(raw.accountCode ?? "").trim() || defaultBelegRevenueAccountCode()
  const vat = resolveBelegVatFields({
    taxCode: raw.taxCode,
    taxRate: raw.taxRate,
    taxRatePercent: raw.taxRatePercent,
  })
  const lineTotal = computePositionLineTotal(
    quantity,
    unitPrice,
    discountPercent
  )
  const unit = normalizeBelegUnit(
    raw.unit !== undefined && raw.unit !== null && String(raw.unit).trim() !== ""
      ? raw.unit
      : raw.einheit
  )

  return {
    id: String(raw.id ?? `pos-${index + 1}`).trim() || `pos-${index + 1}`,
    name: String(raw.name ?? "").trim() || `Position ${index + 1}`,
    details: String(raw.details ?? "").trim() || undefined,
    quantity,
    unit,
    unitPrice,
    accountCode,
    discountPercent,
    taxCode: vat.taxCode,
    taxRate: vat.taxRate,
    taxRatePercent: vat.taxRatePercent,
    lineTotal,
  }
}

export function isValidBelegStatus(type: BelegType, status: string): boolean {
  return statusesForType(type).includes(status as BelegStatus)
}

export function normalizeBeleg(
  raw: Partial<Beleg> & { id: string; type: BelegType },
  existing?: Beleg | null
): Beleg {
  const type = raw.type
  const positionen = Array.isArray(raw.positionen)
    ? raw.positionen.map((p, i) => normalizeBelegPosition(p ?? {}, i))
    : existing?.positionen ?? []
  const totals = computeBelegTotals(positionen)
  const statusRaw = String(raw.status ?? existing?.status ?? defaultStatusForType(type))
  const status = isValidBelegStatus(type, statusRaw)
    ? (statusRaw as BelegStatus)
    : defaultStatusForType(type)
  const now = new Date().toISOString()

  return {
    id: String(raw.id).trim(),
    type,
    status,
    kunde: normalizeBelegAddress(raw.kunde ?? existing?.kunde),
    lieferAdresse: raw.lieferAdresse
      ? normalizeBelegAddress(raw.lieferAdresse)
      : existing?.lieferAdresse,
    customerId:
      raw.customerId !== undefined
        ? String(raw.customerId ?? "").trim() || null
        : existing?.customerId ?? null,
    positionen,
    subtotal: totals.subtotal,
    vatTotal: totals.vatTotal,
    total: totals.total,
    linkedTo: raw.linkedTo !== undefined ? raw.linkedTo : existing?.linkedTo ?? null,
    sourceOrderId:
      raw.sourceOrderId !== undefined
        ? raw.sourceOrderId
        : existing?.sourceOrderId ?? null,
    pdfUrl: raw.pdfUrl !== undefined ? raw.pdfUrl : existing?.pdfUrl ?? null,
    notes:
      raw.notes !== undefined
        ? String(raw.notes ?? "").trim() || undefined
        : existing?.notes,
    createdAt: existing?.createdAt ?? raw.createdAt ?? now,
    updatedAt: now,
  }
}

export function toBelegCosmosDoc(beleg: Beleg): BelegCosmosDoc {
  return {
    ...beleg,
    id: belegCosmosId(beleg.id),
    docType: BELEG_DOC_TYPE,
  }
}

export function fromBelegCosmosDoc(doc: BelegCosmosDoc | Beleg): Beleg {
  const rawId = String(doc.id ?? "")
  const id = rawId.startsWith(`${BELEG_DOC_TYPE}:`)
    ? rawId.slice(BELEG_DOC_TYPE.length + 1)
    : rawId
  return normalizeBeleg(
    {
      ...doc,
      id,
      type: doc.type,
    },
    null
  )
}

export function stripPricesForDeliveryNote(positionen: BelegPosition[]): BelegPosition[] {
  return positionen.map((pos) =>
    normalizeBelegPosition(
      {
        ...pos,
        unitPrice: 0,
        discountPercent: 0,
        taxCode: DEFAULT_BELEG_VAT.taxCode,
        taxRate: DEFAULT_BELEG_VAT.taxRate,
        taxRatePercent: DEFAULT_BELEG_VAT.taxRatePercent,
        lineTotal: 0,
      },
      0
    )
  )
}
