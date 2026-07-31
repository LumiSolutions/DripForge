import { NextResponse } from "next/server"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { getOrdersForCustomerEmail } from "@/lib/konto/customer-orders"
import type { CustomerDocumentRow } from "@/lib/konto/customer-documents"

export const dynamic = "force-dynamic"

/** Chronologische Belege zu Kundenaufträgen (aktuell: Rechnungen). */
export async function GET() {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  try {
    const orders = await getOrdersForCustomerEmail(email)
    const documents: CustomerDocumentRow[] = []

    for (const order of orders) {
      documents.push({
        id: `rechnung-${order.orderId}`,
        orderId: order.orderId,
        type: "rechnung",
        label: `Rechnung ${order.orderId}`,
        createdAt: order.createdAt,
        downloadUrl: order.canDownloadInvoice
          ? `/api/customer/invoices/${encodeURIComponent(order.orderId)}`
          : null,
        available: order.canDownloadInvoice,
      })
    }

    documents.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({ documents })
  } catch (error) {
    console.error("Konto Belege fehlgeschlagen.", error)
    return NextResponse.json({ documents: [] })
  }
}
