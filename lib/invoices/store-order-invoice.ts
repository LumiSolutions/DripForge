import { promises as fs } from "fs"
import path from "path"
import { uploadOrderInvoicePdf } from "@/lib/azure/upload-order-invoice"

const INVOICES_DIR = path.join(process.cwd(), "data", "admin", "invoices")

export type StoredInvoiceResult = {
  rechnungPdfUrl?: string
  rechnungPdfPath?: string
}

export async function storeOrderInvoicePdf(
  orderId: string,
  buffer: Buffer
): Promise<StoredInvoiceResult> {
  const url = await uploadOrderInvoicePdf(orderId, buffer)
  if (url) {
    return { rechnungPdfUrl: url }
  }

  await fs.mkdir(INVOICES_DIR, { recursive: true })
  const filename = `${orderId.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`
  const filePath = path.join(INVOICES_DIR, filename)
  await fs.writeFile(filePath, buffer)
  return { rechnungPdfPath: filename }
}

export async function readStoredInvoicePdf(
  stored: StoredInvoiceResult
): Promise<Buffer | null> {
  if (stored.rechnungPdfPath) {
    try {
      return await fs.readFile(path.join(INVOICES_DIR, stored.rechnungPdfPath))
    } catch {
      // Fallback auf URL unten
    }
  }

  if (stored.rechnungPdfUrl) {
    try {
      const res = await fetch(stored.rechnungPdfUrl)
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer())
      }
    } catch (error) {
      console.warn("Rechnung: PDF konnte nicht von URL geladen werden.", error)
    }
  }

  return null
}
