import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  DOCUMENT_TEMPLATE_DOC_ID,
  DOCUMENT_TEMPLATE_DOC_TYPE,
  LEGACY_INVOICE_TEMPLATE_DOC_ID,
  LEGACY_INVOICE_TEMPLATE_DOC_TYPE,
  mergeDocumentTemplateSettings,
  sanitizeDocumentTemplateInput,
  type DocumentTemplateSettings,
} from "@/lib/documents/document-template-types"

type DocumentTemplateCosmosDoc = Partial<DocumentTemplateSettings> & {
  id: string
  docType: string
}

async function readTemplateDoc(id: string): Promise<DocumentTemplateCosmosDoc | null> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container.item(id, id).read<DocumentTemplateCosmosDoc>()
    return resource ?? null
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      logCosmosError(`cosmosGetDocumentTemplateSettings:${id}`, error)
      throw error
    }
  }
  return null
}

export async function cosmosGetDocumentTemplateSettings(
  company?: import("@/lib/admin/types").CompanySettings
): Promise<DocumentTemplateSettings> {
  const current = await readTemplateDoc(DOCUMENT_TEMPLATE_DOC_ID)
  if (current?.docType === DOCUMENT_TEMPLATE_DOC_TYPE) {
    return mergeDocumentTemplateSettings(current, company)
  }

  const legacy = await readTemplateDoc(LEGACY_INVOICE_TEMPLATE_DOC_ID)
  if (legacy?.docType === LEGACY_INVOICE_TEMPLATE_DOC_TYPE) {
    return mergeDocumentTemplateSettings(legacy, company)
  }

  return mergeDocumentTemplateSettings(null, company)
}

export async function cosmosSaveDocumentTemplateSettings(
  settings: DocumentTemplateSettings
): Promise<DocumentTemplateSettings> {
  const container = await getSettingsContainer()
  const doc: DocumentTemplateCosmosDoc = {
    id: DOCUMENT_TEMPLATE_DOC_ID,
    docType: DOCUMENT_TEMPLATE_DOC_TYPE,
    ...settings,
  }
  await container.items.upsert(doc)
  return settings
}

export function sanitizeAndMergeDocumentTemplate(
  body: unknown,
  existing: DocumentTemplateSettings
): DocumentTemplateSettings {
  return sanitizeDocumentTemplateInput(body, existing)
}

export const cosmosGetInvoiceTemplateSettings = cosmosGetDocumentTemplateSettings
export const cosmosSaveInvoiceTemplateSettings = cosmosSaveDocumentTemplateSettings
export const sanitizeAndMergeInvoiceTemplate = sanitizeAndMergeDocumentTemplate
