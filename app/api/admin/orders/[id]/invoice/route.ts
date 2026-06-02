import { NextResponse } from "next/server"
import { getOrderById, getSettings } from "@/lib/admin/db"
import { ensureOrderInvoicePdf } from "@/lib/invoices/process-order-invoice"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const order = await getOrderById(id)

    if (!order) {
      return NextResponse.json(
        { error: "Bestellung nicht gefunden." },
        { status: 404 }
      )
    }

    const settings = await getSettings()
    const pdfBuffer = await ensureOrderInvoicePdf(order, settings)
    const filename = `Rechnung-${order.orderId}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache",
      },
    })
  } catch (error) {
    console.warn("Admin-API: Rechnung konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Rechnung konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}
