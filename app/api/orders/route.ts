import { NextResponse } from "next/server"
import { uploadOrderLeitbild } from "@/lib/azure/upload-order-leitbild"
import { saveOrder, getSettings, upsertCustomerFromOrder } from "@/lib/admin/db"
import { processOrderInvoice } from "@/lib/invoices/process-order-invoice"
import { getPaymentMethodLabel } from "@/lib/admin/types"
import type { StoredOrder, StoredOrderItem } from "@/lib/admin/types"
import type { OrderPayload } from "@/lib/dripforge/submit-order"

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as OrderPayload

    if (!payload.items?.length || !payload.billing?.email) {
      return NextResponse.json(
        { error: "Unvollstaendige Bestelldaten." },
        { status: 400 }
      )
    }

    const orderId = `df-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const settings = await getSettings()

    const itemResults = await Promise.all(
      payload.items.map(async (item) => {
        let leitbildUrl: string | null = null
        if (item.leitbild) {
          leitbildUrl = await uploadOrderLeitbild(orderId, item.id, item.leitbild)
        }
        return { id: item.id, leitbildUrl }
      })
    )

    const items: StoredOrderItem[] = payload.items.map((item) => {
      const uploaded = itemResults.find((r) => r.id === item.id)
      return {
        ...item,
        leitbildUrl: uploaded?.leitbildUrl ?? null,
      }
    })

    const order: StoredOrder = {
      orderId,
      createdAt: new Date().toISOString(),
      status: "ausstehend",
      billing: payload.billing,
      delivery: payload.delivery,
      shippingMethod: payload.shippingMethod,
      paymentMethod: payload.paymentMethod,
      paymentMethodLabel: getPaymentMethodLabel(
        payload.paymentMethod,
        settings.checkout
      ),
      items,
      totals: payload.totals,
    }

    await saveOrder(order)
    const customer = await upsertCustomerFromOrder(order)

    const orderWithCustomer: StoredOrder = {
      ...order,
      kundennummer: customer.kundennummer,
    }

    void processOrderInvoice(orderWithCustomer, settings)

    return NextResponse.json({
      orderId,
      kundennummer: customer.kundennummer,
      items: itemResults,
      message: "Bestellung erfolgreich uebermittelt.",
    })
  } catch (error) {
    console.warn("Bestell-API: Verarbeitung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Interner Serverfehler bei der Bestellung." },
      { status: 500 }
    )
  }
}
