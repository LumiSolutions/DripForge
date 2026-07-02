import {
  DEFAULT_COMPANY_SETTINGS,
  type CompanySettings,
} from "@/lib/admin/types"
import { DRIPFORGE_LOGO_URL } from "@/lib/invoices/invoice-format"

export const INVOICE_TEMPLATE_DOC_ID = "invoice-template"
export const INVOICE_TEMPLATE_DOC_TYPE = "invoice-template"

export type InvoiceTemplateSettings = {
  firmenname: string
  inhaber: string
  firmenAdresse: string
  kontaktEmail: string
  iban: string
  bankname: string
  logoUrl: string | null
  paymentTermsDays: number
  introText: string
  closingText: string
  footerNote: string
  /** Freitextzeile oben, z.B. "Rechnung Nr. {rechnungsnummer}" */
  headerInvoiceLine: string
  /** Zweite Kopfzeile, z.B. "I/Referenz {rechnungsnummer}" */
  headerReferenceLine: string
  /** Text im Zahlungsblock unter IBAN / Kontoinhaber */
  paymentBlockText: string
  /** Zentrierter Footer (ganz unten) */
  centerFooterText: string
  updatedAt: string
}

export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplateSettings = {
  firmenname: DEFAULT_COMPANY_SETTINGS.firmenname,
  inhaber: "Robin Schulz",
  firmenAdresse: "Mattenstrasse 7\n8330 Pfäffikon ZH",
  kontaktEmail: DEFAULT_COMPANY_SETTINGS.kontaktEmail,
  iban: DEFAULT_COMPANY_SETTINGS.iban,
  bankname: DEFAULT_COMPANY_SETTINGS.bankname,
  logoUrl: DRIPFORGE_LOGO_URL,
  paymentTermsDays: 30,
  introText: "Vielen Dank fuer Ihre Bestellung bei {firmenname}.",
  closingText:
    "Bitte ueberweisen Sie den Gesamtbetrag innerhalb von {zahlungsfrist} Tagen auf IBAN {iban}{bank}. Verwendungszweck: {rechnungsnummer}",
  footerNote: "",
  headerInvoiceLine: "Rechnung Nr. {rechnungsnummer}",
  headerReferenceLine: "I/Referenz {rechnungsnummer}",
  paymentBlockText:
    "Zahlbar innert {zahlungsfrist} Tagen. Bitte geben Sie die Referenz als Zahlungszweck an.",
  centerFooterText:
    "DripForge — Robin Schulz · Mattenstrasse 7 · 8330 Pfäffikon ZH · drip-forge@outlook.com",
  updatedAt: new Date(0).toISOString(),
}

function trimString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback
}

export function mergeInvoiceTemplateSettings(
  stored: Partial<InvoiceTemplateSettings> | null | undefined,
  company?: CompanySettings
): InvoiceTemplateSettings {
  const base = {
    ...DEFAULT_INVOICE_TEMPLATE,
    firmenname: company?.firmenname ?? DEFAULT_INVOICE_TEMPLATE.firmenname,
    firmenAdresse: company?.firmenAdresse ?? DEFAULT_INVOICE_TEMPLATE.firmenAdresse,
    kontaktEmail: company?.kontaktEmail ?? DEFAULT_INVOICE_TEMPLATE.kontaktEmail,
    iban: company?.iban ?? DEFAULT_INVOICE_TEMPLATE.iban,
    bankname: company?.bankname ?? DEFAULT_INVOICE_TEMPLATE.bankname,
  }

  if (!stored) return { ...base, updatedAt: new Date().toISOString() }

  const paymentTermsDays =
    typeof stored.paymentTermsDays === "number" && stored.paymentTermsDays > 0
      ? Math.round(stored.paymentTermsDays)
      : base.paymentTermsDays

  return {
    firmenname: trimString(stored.firmenname, base.firmenname),
    inhaber: trimString(stored.inhaber, base.inhaber),
    firmenAdresse: trimString(stored.firmenAdresse, base.firmenAdresse),
    kontaktEmail: trimString(stored.kontaktEmail, base.kontaktEmail),
    iban: trimString(stored.iban, base.iban),
    bankname: trimString(stored.bankname, base.bankname),
    logoUrl:
      stored.logoUrl === null
        ? null
        : trimString(stored.logoUrl, base.logoUrl ?? DRIPFORGE_LOGO_URL),
    paymentTermsDays,
    introText: trimString(stored.introText, base.introText),
    closingText: trimString(stored.closingText, base.closingText),
    footerNote: trimString(stored.footerNote, base.footerNote),
    headerInvoiceLine: trimString(stored.headerInvoiceLine, base.headerInvoiceLine),
    headerReferenceLine: trimString(stored.headerReferenceLine, base.headerReferenceLine),
    paymentBlockText: trimString(stored.paymentBlockText, base.paymentBlockText),
    centerFooterText: trimString(stored.centerFooterText, base.centerFooterText),
    updatedAt:
      typeof stored.updatedAt === "string" ? stored.updatedAt : new Date().toISOString(),
  }
}

export function sanitizeInvoiceTemplateInput(
  body: unknown,
  existing: InvoiceTemplateSettings
): InvoiceTemplateSettings {
  if (!body || typeof body !== "object") return existing
  const b = body as Record<string, unknown>

  const paymentTermsDays =
    typeof b.paymentTermsDays === "number" && b.paymentTermsDays > 0
      ? Math.min(120, Math.round(b.paymentTermsDays))
      : existing.paymentTermsDays

  return {
    firmenname: trimString(b.firmenname, existing.firmenname),
    inhaber: trimString(b.inhaber, existing.inhaber),
    firmenAdresse: trimString(b.firmenAdresse, existing.firmenAdresse),
    kontaktEmail: trimString(b.kontaktEmail, existing.kontaktEmail),
    iban: trimString(b.iban, existing.iban),
    bankname: trimString(b.bankname, existing.bankname),
    logoUrl:
      b.logoUrl === null
        ? null
        : typeof b.logoUrl === "string"
          ? b.logoUrl.trim() || null
          : existing.logoUrl,
    paymentTermsDays,
    introText: trimString(b.introText, existing.introText),
    closingText: trimString(b.closingText, existing.closingText),
    footerNote: trimString(b.footerNote, existing.footerNote),
    headerInvoiceLine: trimString(b.headerInvoiceLine, existing.headerInvoiceLine),
    headerReferenceLine: trimString(b.headerReferenceLine, existing.headerReferenceLine),
    paymentBlockText: trimString(b.paymentBlockText, existing.paymentBlockText),
    centerFooterText: trimString(b.centerFooterText, existing.centerFooterText),
    updatedAt: new Date().toISOString(),
  }
}

export function applyInvoiceTemplatePlaceholders(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")
}
