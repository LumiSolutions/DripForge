import { getDocumentTemplateSettings } from "@/lib/admin/db"
import type { AdminSettings } from "@/lib/admin/types"
import { buildDocumentFooterLines } from "@/lib/documents/document-template-types"

export async function resolveEmailBranding(settings: AdminSettings) {
  const template = await getDocumentTemplateSettings()
  const footerLines = buildDocumentFooterLines(template)
  const layoutLogo =
    typeof settings.orderEmailLayout?.logoUrl === "string"
      ? settings.orderEmailLayout.logoUrl.trim()
      : ""
  return {
    companyName: settings.company.firmenname,
    contactEmail: settings.company.kontaktEmail,
    logoUrl: layoutLogo || template.logoUrl,
    footerLines,
  }
}
