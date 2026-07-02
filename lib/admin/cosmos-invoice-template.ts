import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  INVOICE_TEMPLATE_DOC_ID,
  INVOICE_TEMPLATE_DOC_TYPE,
  mergeInvoiceTemplateSettings,
  sanitizeInvoiceTemplateInput,
  type InvoiceTemplateSettings,
} from "@/lib/invoices/invoice-template-types"

type InvoiceTemplateCosmosDoc = InvoiceTemplateSettings & {
  id: string
  docType: string
}

export async function cosmosGetInvoiceTemplateSettings(
  company?: import("@/lib/admin/types").CompanySettings
): Promise<InvoiceTemplateSettings> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(INVOICE_TEMPLATE_DOC_ID, INVOICE_TEMPLATE_DOC_ID)
      .read<InvoiceTemplateCosmosDoc>()
    if (resource?.docType === INVOICE_TEMPLATE_DOC_TYPE) {
      return mergeInvoiceTemplateSettings(resource, company)
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      logCosmosError("cosmosGetInvoiceTemplateSettings", error)
      throw error
    }
  }
  return mergeInvoiceTemplateSettings(null, company)
}

export async function cosmosSaveInvoiceTemplateSettings(
  settings: InvoiceTemplateSettings
): Promise<InvoiceTemplateSettings> {
  const container = await getSettingsContainer()
  const doc: InvoiceTemplateCosmosDoc = {
    id: INVOICE_TEMPLATE_DOC_ID,
    docType: INVOICE_TEMPLATE_DOC_TYPE,
    ...settings,
  }
  await container.items.upsert(doc)
  return settings
}

export function sanitizeAndMergeInvoiceTemplate(
  body: unknown,
  existing: InvoiceTemplateSettings
): InvoiceTemplateSettings {
  return sanitizeInvoiceTemplateInput(body, existing)
}
