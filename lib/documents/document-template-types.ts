import {
  DEFAULT_COMPANY_SETTINGS,
  type CompanySettings,
} from "@/lib/admin/types"
import { DRIPFORGE_LOGO_URL } from "@/lib/invoices/invoice-format"

export const DOCUMENT_TEMPLATE_DOC_ID = "document-template"
export const DOCUMENT_TEMPLATE_DOC_TYPE = "document_template"
export const LEGACY_INVOICE_TEMPLATE_DOC_ID = "invoice-template"
export const LEGACY_INVOICE_TEMPLATE_DOC_TYPE = "invoice-template"

export const DOCUMENT_TEMPLATE_TYPES = [
  "invoice",
  "quote",
  "deliveryNote",
] as const

export type DocumentTemplateType = (typeof DOCUMENT_TEMPLATE_TYPES)[number]

export const LOGO_ALIGNMENTS = ["left", "center", "right"] as const
export type DocumentLogoAlignment = (typeof LOGO_ALIGNMENTS)[number]

export const MWST_EXEMPT_LEGAL_NOTE =
  "*Befreit von der Mehrwertsteuerpflicht aufgrund der Umsatzgrenze gemäss Art. 10 MWSTG."

export type DocumentTypeTextSettings = {
  label: string
  numberPlaceholder: string
  headerLine: string
  referenceLine: string
  introText: string
  closingText: string
  footerNote: string
  paymentBlockText: string
  centerFooterText: string
  showPaymentBlock: boolean
}

export type DocumentTemplateSettings = {
  firmenname: string
  inhaber: string
  firmenAdresse: string
  kontaktEmail: string
  website: string
  iban: string
  bankname: string
  logoUrl: string | null
  logoAlignment: DocumentLogoAlignment
  qrPaymentImageUrl: string | null
  paymentTermsDays: number
  documentTypes: Record<DocumentTemplateType, DocumentTypeTextSettings>
  updatedAt: string
}

type LegacyInvoiceTemplateSettings = Partial<{
  firmenname: string
  inhaber: string
  firmenAdresse: string
  kontaktEmail: string
  website: string
  iban: string
  bankname: string
  logoUrl: string | null
  logoAlignment: DocumentLogoAlignment
  qrPaymentImageUrl: string | null
  paymentTermsDays: number
  introText: string
  closingText: string
  footerNote: string
  headerInvoiceLine: string
  headerReferenceLine: string
  paymentBlockText: string
  centerFooterText: string
  updatedAt: string
}>

export const DEFAULT_DOCUMENT_TYPE_TEXTS: Record<
  DocumentTemplateType,
  DocumentTypeTextSettings
> = {
  invoice: {
    label: "Rechnung",
    numberPlaceholder: "rechnungsnummer",
    headerLine: "Rechnung Nr. {rechnungsnummer}",
    referenceLine: "I/Referenz {rechnungsnummer}",
    introText: "Vielen Dank fuer Ihre Bestellung bei {firmenname}.",
    closingText:
      "Bitte ueberweisen Sie den Gesamtbetrag innerhalb von {zahlungsfrist} Tagen auf IBAN {iban}{bank}. Verwendungszweck: {rechnungsnummer}",
    footerNote: "",
    paymentBlockText:
      "Zahlbar innert {zahlungsfrist} Tagen. Bitte geben Sie die Referenz als Zahlungszweck an.",
    centerFooterText:
      "DripForge - Robin Schulz · Mattenstrasse 7 · 8330 Pfaeffikon ZH · drip-forge@outlook.com",
    showPaymentBlock: true,
  },
  quote: {
    label: "Angebot",
    numberPlaceholder: "angebotsnummer",
    headerLine: "Angebot Nr. {angebotsnummer}",
    referenceLine: "Referenz {angebotsnummer}",
    introText: "Vielen Dank fuer Ihre Anfrage bei {firmenname}.",
    closingText: "Dieses Angebot ist ab {datum} erstellt und freibleibend.",
    footerNote: "",
    paymentBlockText: "",
    centerFooterText:
      "DripForge - Robin Schulz · Mattenstrasse 7 · 8330 Pfaeffikon ZH · drip-forge@outlook.com",
    showPaymentBlock: false,
  },
  deliveryNote: {
    label: "Lieferschein",
    numberPlaceholder: "lieferscheinnummer",
    headerLine: "Lieferschein Nr. {lieferscheinnummer}",
    referenceLine: "Referenz {lieferscheinnummer}",
    introText: "Folgende Positionen werden geliefert.",
    closingText: "",
    footerNote: "",
    paymentBlockText: "",
    centerFooterText:
      "DripForge - Robin Schulz · Mattenstrasse 7 · 8330 Pfaeffikon ZH · drip-forge@outlook.com",
    showPaymentBlock: false,
  },
}

export const DEFAULT_DOCUMENT_TEMPLATE: DocumentTemplateSettings = {
  firmenname: DEFAULT_COMPANY_SETTINGS.firmenname,
  inhaber: "Robin Schulz",
  firmenAdresse: "Mattenstrasse 7\n8330 Pfäffikon ZH",
  kontaktEmail: DEFAULT_COMPANY_SETTINGS.kontaktEmail,
  website: "www.dripforge.ch",
  iban: DEFAULT_COMPANY_SETTINGS.iban,
  bankname: DEFAULT_COMPANY_SETTINGS.bankname,
  logoUrl: DRIPFORGE_LOGO_URL,
  logoAlignment: "right",
  qrPaymentImageUrl: null,
  paymentTermsDays: 30,
  documentTypes: DEFAULT_DOCUMENT_TYPE_TEXTS,
  updatedAt: new Date(0).toISOString(),
}

function trimString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback
}

function normalizeLogoUrl(value: unknown, fallback: string | null): string | null {
  if (value === null) return null
  if (typeof value === "string") return value.trim() || null
  return fallback
}

function normalizePaymentTerms(value: unknown, fallback: number): number {
  return typeof value === "number" && value > 0 ? Math.min(120, Math.round(value)) : fallback
}

function normalizeLogoAlignment(
  value: unknown,
  fallback: DocumentLogoAlignment
): DocumentLogoAlignment {
  return LOGO_ALIGNMENTS.includes(value as DocumentLogoAlignment)
    ? (value as DocumentLogoAlignment)
    : fallback
}

export function formatDocumentDueDate(isoDate: string, paymentTermsDays: number): string {
  const due = new Date(isoDate)
  due.setDate(due.getDate() + paymentTermsDays)
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(due)
}

export function buildDocumentFooterText(template: DocumentTemplateSettings): string {
  const address = template.firmenAdresse.replace(/\n/g, " · ")
  const parts = [
    template.firmenname,
    template.inhaber,
    address,
    template.kontaktEmail,
    template.website,
  ].filter(Boolean)
  return parts.join(" · ")
}

function mergeDocumentTypeTextSettings(
  stored: Partial<DocumentTypeTextSettings> | null | undefined,
  fallback: DocumentTypeTextSettings
): DocumentTypeTextSettings {
  return {
    label: trimString(stored?.label, fallback.label),
    numberPlaceholder: trimString(stored?.numberPlaceholder, fallback.numberPlaceholder),
    headerLine: trimString(stored?.headerLine, fallback.headerLine),
    referenceLine: trimString(stored?.referenceLine, fallback.referenceLine),
    introText: trimString(stored?.introText, fallback.introText),
    closingText: trimString(stored?.closingText, fallback.closingText),
    footerNote: trimString(stored?.footerNote, fallback.footerNote),
    paymentBlockText: trimString(stored?.paymentBlockText, fallback.paymentBlockText),
    centerFooterText: trimString(stored?.centerFooterText, fallback.centerFooterText),
    showPaymentBlock:
      typeof stored?.showPaymentBlock === "boolean"
        ? stored.showPaymentBlock
        : fallback.showPaymentBlock,
  }
}

function hasDocumentTypes(
  stored: Partial<DocumentTemplateSettings> | null | undefined
): stored is Partial<DocumentTemplateSettings> & {
  documentTypes: Partial<Record<DocumentTemplateType, Partial<DocumentTypeTextSettings>>>
} {
  return Boolean(stored?.documentTypes && typeof stored.documentTypes === "object")
}

function migrateLegacyInvoiceText(
  stored: LegacyInvoiceTemplateSettings | null | undefined
): Partial<Record<DocumentTemplateType, Partial<DocumentTypeTextSettings>>> {
  if (!stored) return {}
  return {
    invoice: {
      headerLine: stored.headerInvoiceLine,
      referenceLine: stored.headerReferenceLine,
      introText: stored.introText,
      closingText: stored.closingText,
      footerNote: stored.footerNote,
      paymentBlockText: stored.paymentBlockText,
      centerFooterText: stored.centerFooterText,
      showPaymentBlock: true,
    },
  }
}

export function mergeDocumentTemplateSettings(
  stored:
    | Partial<DocumentTemplateSettings>
    | LegacyInvoiceTemplateSettings
    | null
    | undefined,
  company?: CompanySettings
): DocumentTemplateSettings {
  const base = {
    ...DEFAULT_DOCUMENT_TEMPLATE,
    firmenname: company?.firmenname ?? DEFAULT_DOCUMENT_TEMPLATE.firmenname,
    firmenAdresse: company?.firmenAdresse ?? DEFAULT_DOCUMENT_TEMPLATE.firmenAdresse,
    kontaktEmail: company?.kontaktEmail ?? DEFAULT_DOCUMENT_TEMPLATE.kontaktEmail,
    iban: company?.iban ?? DEFAULT_DOCUMENT_TEMPLATE.iban,
    bankname: company?.bankname ?? DEFAULT_DOCUMENT_TEMPLATE.bankname,
  }

  const documentTypeSource = hasDocumentTypes(stored)
    ? stored.documentTypes
    : migrateLegacyInvoiceText(stored as LegacyInvoiceTemplateSettings | null | undefined)

  const documentTypes = DOCUMENT_TEMPLATE_TYPES.reduce(
    (acc, type) => {
      acc[type] = mergeDocumentTypeTextSettings(
        documentTypeSource[type],
        base.documentTypes[type]
      )
      return acc
    },
    {} as Record<DocumentTemplateType, DocumentTypeTextSettings>
  )

  if (!stored) {
    return { ...base, documentTypes, updatedAt: new Date().toISOString() }
  }

  return {
    firmenname: trimString(stored.firmenname, base.firmenname),
    inhaber: trimString(stored.inhaber, base.inhaber),
    firmenAdresse: trimString(stored.firmenAdresse, base.firmenAdresse),
    kontaktEmail: trimString(stored.kontaktEmail, base.kontaktEmail),
    website: trimString(stored.website, base.website),
    iban: trimString(stored.iban, base.iban),
    bankname: trimString(stored.bankname, base.bankname),
    logoUrl: normalizeLogoUrl(stored.logoUrl, base.logoUrl ?? DRIPFORGE_LOGO_URL),
    logoAlignment: normalizeLogoAlignment(stored.logoAlignment, base.logoAlignment),
    qrPaymentImageUrl: normalizeLogoUrl(stored.qrPaymentImageUrl, base.qrPaymentImageUrl),
    paymentTermsDays: normalizePaymentTerms(stored.paymentTermsDays, base.paymentTermsDays),
    documentTypes,
    updatedAt:
      typeof stored.updatedAt === "string" ? stored.updatedAt : new Date().toISOString(),
  }
}

export function sanitizeDocumentTemplateInput(
  body: unknown,
  existing: DocumentTemplateSettings
): DocumentTemplateSettings {
  if (!body || typeof body !== "object") return existing
  const b = body as Record<string, unknown>
  const incomingDocumentTypes =
    b.documentTypes && typeof b.documentTypes === "object"
      ? (b.documentTypes as Partial<
          Record<DocumentTemplateType, Partial<DocumentTypeTextSettings>>
        >)
      : migrateLegacyInvoiceText(b as LegacyInvoiceTemplateSettings)

  const documentTypes = DOCUMENT_TEMPLATE_TYPES.reduce(
    (acc, type) => {
      acc[type] = mergeDocumentTypeTextSettings(
        incomingDocumentTypes[type],
        existing.documentTypes[type]
      )
      return acc
    },
    {} as Record<DocumentTemplateType, DocumentTypeTextSettings>
  )

  return {
    firmenname: trimString(b.firmenname, existing.firmenname),
    inhaber: trimString(b.inhaber, existing.inhaber),
    firmenAdresse: trimString(b.firmenAdresse, existing.firmenAdresse),
    kontaktEmail: trimString(b.kontaktEmail, existing.kontaktEmail),
    website: trimString(b.website, existing.website),
    iban: trimString(b.iban, existing.iban),
    bankname: trimString(b.bankname, existing.bankname),
    logoUrl: normalizeLogoUrl(b.logoUrl, existing.logoUrl),
    logoAlignment: normalizeLogoAlignment(b.logoAlignment, existing.logoAlignment),
    qrPaymentImageUrl: normalizeLogoUrl(b.qrPaymentImageUrl, existing.qrPaymentImageUrl),
    paymentTermsDays: normalizePaymentTerms(b.paymentTermsDays, existing.paymentTermsDays),
    documentTypes,
    updatedAt: new Date().toISOString(),
  }
}

export function buildDocumentPlaceholderValues(
  template: DocumentTemplateSettings,
  values: Record<string, string>
): Record<string, string> {
  const bank = template.bankname ? ` (${template.bankname})` : ""
  return {
    firmenname: template.firmenname,
    inhaber: template.inhaber,
    iban: template.iban,
    bank,
    zahlungsfrist: String(template.paymentTermsDays),
    ...values,
  }
}

export function applyDocumentTemplatePlaceholders(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")
}
