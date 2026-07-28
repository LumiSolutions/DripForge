import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { getOrderForCustomerEmail } from "@/lib/konto/customer-orders"
import {
  isCustomerAuthError,
  requireCustomerSession,
} from "@/lib/konto/customer-api-auth"
import { ensureOrderInvoicePdf } from "@/lib/invoices/process-order-invoice"

type RouteContext = { params: Promise<{ orderId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireCustomerSession()
  if (isCustomerAuthError(auth)) return auth

  try {
    const { orderId } = await context.params
    const order = await getOrderForCustomerEmail(auth.email, orderId)

    if (!order) {
      return NextResponse.json(
        { error: "Bestellung nicht gefunden." },
        { status: 404 }
      )
    }

    const canDownload =
      order.paymentMethod === "invoice" || order.paymentConfirmed === true

    if (!canDownload) {
      return NextResponse.json(
        { error: "Rechnung ist erst nach Zahlungsbestätigung verfügbar." },
        { status: 403 }
      )
    }

    const wantsJson =
      request.headers.get("accept")?.includes("application/json") ||
      new URL(request.url).searchParams.get("format") === "json"

    const settings = await getSettings()
    const pdfBuffer = await ensureOrderInvoicePdf(order, settings)
    const filename = `Rechnung-${order.orderId}.pdf`

    if (wantsJson) {
      return NextResponse.json({
        orderId: order.orderId,
        filename,
        downloadUrl: `/api/customer/invoices/${encodeURIComponent(order.orderId)}`,
        hasInvoice: true,
      })
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache",
      },
    })
  } catch (error) {
    console.error("Customer-API: Rechnung konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Rechnung konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}
