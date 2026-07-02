import { renderToBuffer } from "@react-pdf/renderer"
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { InvoiceDocument } from "@/lib/invoices/invoice-document"
import type { InvoiceTemplateSettings } from "@/lib/invoices/invoice-template-types"
import { getInvoiceTemplateSettings } from "@/lib/admin/db"
import { createSwissQrBillDataUrl } from "@/lib/invoices/swiss-qr-bill"

export async function generateInvoicePdfBuffer(
  order: StoredOrder,
  settings: AdminSettings,
  template?: InvoiceTemplateSettings
): Promise<Buffer> {
  const invoiceTemplate = template ?? (await getInvoiceTemplateSettings())
  const qrDataUrl = await createSwissQrBillDataUrl({
    order,
    template: invoiceTemplate,
  })

  const buffer = await renderToBuffer(
    <InvoiceDocument
      order={order}
      settings={settings}
      template={invoiceTemplate}
      qrDataUrl={qrDataUrl}
    />
  )
  return Buffer.from(buffer)
}
