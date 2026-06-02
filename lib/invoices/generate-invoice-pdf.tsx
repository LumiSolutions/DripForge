import { renderToBuffer } from "@react-pdf/renderer"
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { InvoiceDocument } from "@/lib/invoices/invoice-document"

export async function generateInvoicePdfBuffer(
  order: StoredOrder,
  settings: AdminSettings
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <InvoiceDocument order={order} settings={settings} />
  )
  return Buffer.from(buffer)
}
