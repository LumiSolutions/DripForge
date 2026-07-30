/** Öffentliche Firmendaten (Admin-Einstellungen → Storefront). */

import {
  DEFAULT_COMPANY_SETTINGS,
  type CompanySettings,
} from "@/lib/admin/types"

/** Legacy-Adresse, die noch in Site-Texten / UI hardcodiert sein kann. */
export const LEGACY_CONTACT_EMAIL = "drip-forge@outlook.com"

export type PublicCompanySettings = CompanySettings

export function normalizeCompanySettings(
  input?: Partial<CompanySettings> | null
): CompanySettings {
  const firmenname =
    typeof input?.firmenname === "string" && input.firmenname.trim()
      ? input.firmenname.trim()
      : DEFAULT_COMPANY_SETTINGS.firmenname

  const firmenAdresse =
    typeof input?.firmenAdresse === "string" && input.firmenAdresse.trim()
      ? input.firmenAdresse.trim()
      : DEFAULT_COMPANY_SETTINGS.firmenAdresse

  const kontaktEmail =
    typeof input?.kontaktEmail === "string" && input.kontaktEmail.trim()
      ? input.kontaktEmail.trim()
      : DEFAULT_COMPANY_SETTINGS.kontaktEmail

  const telefonnummer =
    typeof input?.telefonnummer === "string" ? input.telefonnummer.trim() : ""

  const iban = typeof input?.iban === "string" ? input.iban.trim() : ""
  const bankname = typeof input?.bankname === "string" ? input.bankname.trim() : ""

  return {
    firmenname,
    firmenAdresse,
    kontaktEmail,
    telefonnummer,
    iban,
    bankname,
  }
}

/**
 * Ersetzt Platzhalter und bekannte Legacy-Kontaktdaten in Texten
 * (z. B. Impressum / Datenschutz / AGB Site-Texte).
 */
export function applyCompanyPlaceholders(
  text: string,
  companyInput?: Partial<CompanySettings> | null
): string {
  const company = normalizeCompanySettings(companyInput)
  let result = String(text ?? "")

  result = result
    .replaceAll("{firmenname}", company.firmenname)
    .replaceAll("{firmenAdresse}", company.firmenAdresse)
    .replaceAll("{kontaktEmail}", company.kontaktEmail)
    .replaceAll("{telefonnummer}", company.telefonnummer)
    .replaceAll("{iban}", company.iban)
    .replaceAll("{bankname}", company.bankname)
    .replaceAll(LEGACY_CONTACT_EMAIL, company.kontaktEmail)

  // Leere Telefon-Zeilen entfernen, wenn keine Nummer hinterlegt ist
  if (!company.telefonnummer) {
    result = result
      .replace(/^[ \t]*Telefon:[ \t]*\r?\n/gm, "")
      .replace(/\r?\n[ \t]*Telefon:[ \t]*$/g, "")
  }

  return result
}

export function companyMailtoHref(company?: Partial<CompanySettings> | null): string {
  const email = normalizeCompanySettings(company).kontaktEmail
  return `mailto:${email}`
}

export function companyTelHref(company?: Partial<CompanySettings> | null): string | null {
  const phone = normalizeCompanySettings(company).telefonnummer
  if (!phone) return null
  const normalized = phone.replace(/[^\d+]/g, "")
  return normalized ? `tel:${normalized}` : null
}
