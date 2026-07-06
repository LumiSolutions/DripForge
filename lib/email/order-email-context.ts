import { getDocumentTemplateSettings } from "@/lib/admin/db"
import type { AdminSettings } from "@/lib/admin/types"
import { buildDocumentFooterLines } from "@/lib/documents/document-template-types"

export async function resolveEmailBranding(settings: AdminSettings) {
  const template = await getDocumentTemplateSettings()
  const footerLines = buildDocumentFooterLines(template)
  return {
    companyName: settings.company.firmenname,
    contactEmail: settings.company.kontaktEmail,
    logoUrl: template.logoUrl,
    footerLines,
  }
}
