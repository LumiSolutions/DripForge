import { renderToBuffer } from "@react-pdf/renderer"
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { InvoiceDocument } from "@/lib/invoices/invoice-document"
import {
  type DocumentTemplateSettings,
  type DocumentTemplateType,
} from "@/lib/documents/document-template-types"
import { getDocumentTemplateSettings } from "@/lib/admin/db"
import { createSwissQrBillDataUrl } from "@/lib/invoices/swiss-qr-bill"

export async function generateInvoicePdfBuffer(
  order: StoredOrder,
  settings: AdminSettings,
  template?: DocumentTemplateSettings,
  documentType: DocumentTemplateType = "invoice"
): Promise<Buffer> {
  const documentTemplate = template ?? (await getDocumentTemplateSettings())
  const documentText = documentTemplate.documentTypes[documentType]
  const qrDataUrl = documentText.showPaymentBlock
    ? await createSwissQrBillDataUrl({
        order,
        template: documentTemplate,
      })
    : null

  const buffer = await renderToBuffer(
    <InvoiceDocument
      order={order}
      settings={settings}
      template={documentTemplate}
      qrDataUrl={qrDataUrl}
      documentType={documentType}
    />
  )
  return Buffer.from(buffer)
}
