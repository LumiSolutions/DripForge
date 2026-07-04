import { renderToBuffer } from "@react-pdf/renderer"
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { InvoiceDocument } from "@/lib/invoices/invoice-document"
import {
  type DocumentTemplateSettings,
  type DocumentTemplateType,
} from "@/lib/documents/document-template-types"
import { getDocumentTemplateSettings } from "@/lib/admin/db"

export async function generateInvoicePdfBuffer(
  order: StoredOrder,
  settings: AdminSettings,
  template?: DocumentTemplateSettings,
  documentType: DocumentTemplateType = "invoice"
): Promise<Buffer> {
  const documentTemplate = template ?? (await getDocumentTemplateSettings())

  const buffer = await renderToBuffer(
    <InvoiceDocument
      order={order}
      settings={settings}
      template={documentTemplate}
      documentType={documentType}
    />
  )
  return Buffer.from(buffer)
}
