import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { getSettings, updateOrderInvoice } from "@/lib/admin/db"
import { sendOrderConfirmationEmail } from "@/lib/email/send-order-confirmation"
import { generateInvoicePdfBuffer } from "@/lib/invoices/generate-invoice-pdf"
import { readStoredInvoicePdf, storeOrderInvoicePdf } from "@/lib/invoices/store-order-invoice"

export async function processOrderInvoice(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<void> {
  const adminSettings = settings ?? (await getSettings())

  try {
    const pdfBuffer = await generateInvoicePdfBuffer(order, adminSettings)
    const stored = await storeOrderInvoicePdf(order.orderId, pdfBuffer)

    await updateOrderInvoice(order.orderId, {
      kundennummer: order.kundennummer,
      rechnungPdfUrl: stored.rechnungPdfUrl,
      rechnungPdfPath: stored.rechnungPdfPath,
    })

    await sendOrderConfirmationEmail(order, adminSettings, {
      attachInvoice: order.paymentMethod === "invoice",
      pdfBuffer: order.paymentMethod === "invoice" ? pdfBuffer : undefined,
    })
  } catch (error) {
    console.error(
      `Rechnung: Verarbeitung für Bestellung ${order.orderId} fehlgeschlagen.`,
      error
    )
    throw error
  }
}

export async function ensureOrderInvoicePdf(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<Buffer> {
  const existing = await readStoredInvoicePdf({
    rechnungPdfUrl: order.rechnungPdfUrl,
    rechnungPdfPath: order.rechnungPdfPath,
  })
  if (existing) return existing

  const adminSettings = settings ?? (await getSettings())
  const pdfBuffer = await generateInvoicePdfBuffer(order, adminSettings)
  const stored = await storeOrderInvoicePdf(order.orderId, pdfBuffer)

  await updateOrderInvoice(order.orderId, {
    rechnungPdfUrl: stored.rechnungPdfUrl,
    rechnungPdfPath: stored.rechnungPdfPath,
  })

  return pdfBuffer
}
