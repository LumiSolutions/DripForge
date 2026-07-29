import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { getInvoiceTemplateSettings, getSettings, updateOrderInvoice } from "@/lib/admin/db"
import { upsertRechnungFromOrder } from "@/lib/documents/beleg-service"
import { generateInvoicePdfBuffer } from "@/lib/invoices/generate-invoice-pdf"
import { ensureOrderInvoiceNumber } from "@/lib/invoices/order-invoice-number"
import { readStoredInvoicePdf, storeOrderInvoicePdf } from "@/lib/invoices/store-order-invoice"

function orderIsInvoiceEligible(order: StoredOrder): boolean {
  return order.paymentMethod === "invoice" || order.paymentConfirmed === true
}

/** Rechnungs-PDF erzeugen und speichern (ohne E-Mail). */
export async function generateAndStoreOrderInvoice(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<Buffer> {
  const invoiceNumber = await ensureOrderInvoiceNumber(order)
  const orderWithInvoice: StoredOrder = {
    ...order,
    invoiceNumber,
  }

  const existing = await readStoredInvoicePdf({
    rechnungPdfUrl: order.rechnungPdfUrl,
    rechnungPdfPath: order.rechnungPdfPath,
  })
  if (existing) {
    try {
      await upsertRechnungFromOrder(orderWithInvoice)
    } catch (belegError) {
      console.warn(
        `Belegverwaltung: Rechnung für Order ${order.orderId} konnte nicht synchronisiert werden.`,
        belegError
      )
    }
    return existing
  }

  const adminSettings = settings ?? (await getSettings())
  const template = await getInvoiceTemplateSettings()
  const pdfBuffer = await generateInvoicePdfBuffer(
    orderWithInvoice,
    adminSettings,
    template
  )
  const stored = await storeOrderInvoicePdf(order.orderId, pdfBuffer)

  await updateOrderInvoice(order.orderId, {
    kundennummer: order.kundennummer,
    invoiceNumber,
    rechnungPdfUrl: stored.rechnungPdfUrl,
    rechnungPdfPath: stored.rechnungPdfPath,
  })

  try {
    await upsertRechnungFromOrder({
      ...orderWithInvoice,
      rechnungPdfUrl: stored.rechnungPdfUrl ?? order.rechnungPdfUrl,
      rechnungPdfPath: stored.rechnungPdfPath ?? order.rechnungPdfPath,
    })
  } catch (belegError) {
    console.warn(
      `Belegverwaltung: Rechnung für Order ${order.orderId} konnte nicht synchronisiert werden.`,
      belegError
    )
  }

  return pdfBuffer
}

/** Legacy: Rechnung nur speichern, wenn Zahlung/Rechnungskauf erlaubt. */
export async function processOrderInvoice(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<void> {
  if (!orderIsInvoiceEligible(order)) return

  try {
    await generateAndStoreOrderInvoice(order, settings)
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
  if (!orderIsInvoiceEligible(order)) {
    throw new Error("Rechnung erst nach Zahlungsbestätigung verfügbar.")
  }

  return generateAndStoreOrderInvoice(order, settings)
}
