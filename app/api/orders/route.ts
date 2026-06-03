import { NextResponse } from "next/server"
import { uploadOrderLeitbild } from "@/lib/azure/upload-order-leitbild"
import { saveOrder, getSettings, upsertCustomerFromOrder } from "@/lib/admin/db"
import { isCosmosConfigured } from "@/lib/admin/cosmos-store"
import { processOrderInvoice } from "@/lib/invoices/process-order-invoice"
import { getPaymentMethodLabel } from "@/lib/admin/types"
import type { StoredOrder, StoredOrderItem } from "@/lib/admin/types"
import type { OrderPayload } from "@/lib/dripforge/submit-order"

function stripLeitbildPayload(item: StoredOrderItem): StoredOrderItem {
  const { leitbild: _removed, ...rest } = item
  return rest
}

export async function POST(request: Request) {
  let orderId = ""

  try {
    const payload = (await request.json()) as OrderPayload

    if (!payload.items?.length || !payload.billing?.email) {
      return NextResponse.json(
        { error: "Unvollständige Bestelldaten." },
        { status: 400 }
      )
    }

    orderId = `df-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    console.info(
      `Bestell-API: Verarbeitung gestartet (${orderId}), Speicher: ${
        isCosmosConfigured() ? "Cosmos DB" : "Dateisystem"
      }.`
    )

    const settings = await getSettings()

    const itemResults = await Promise.all(
      payload.items.map(async (item) => {
        let leitbildUrl: string | null = null
        if (item.leitbild) {
          try {
            leitbildUrl = await uploadOrderLeitbild(orderId, item.id, item.leitbild)
          } catch (uploadError) {
            console.error(
              `Bestell-API: Leitbild-Upload fehlgeschlagen (${orderId}, ${item.id}).`,
              uploadError
            )
          }
        }
        return { id: item.id, leitbildUrl }
      })
    )

    const items: StoredOrderItem[] = payload.items.map((item) => {
      const uploaded = itemResults.find((r) => r.id === item.id)
      return stripLeitbildPayload({
        ...item,
        leitbildUrl: uploaded?.leitbildUrl ?? null,
      })
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
    console.info(`Bestell-API: Bestellung gespeichert (${orderId}).`)

    const customer = await upsertCustomerFromOrder(order)
    console.info(
      `Bestell-API: Kunde verknüpft (${customer.kundennummer}, ${orderId}).`
    )

    const orderWithCustomer: StoredOrder = {
      ...order,
      kundennummer: customer.kundennummer,
    }

    try {
      await processOrderInvoice(orderWithCustomer, settings)
      console.info(`Bestell-API: Rechnung/E-Mail verarbeitet (${orderId}).`)
    } catch (invoiceError) {
      console.error(
        `Bestell-API: Rechnung/E-Mail fehlgeschlagen — Bestellung ${orderId} ist trotzdem gespeichert.`,
        invoiceError
      )
    }

    return NextResponse.json({
      orderId,
      kundennummer: customer.kundennummer,
      items: itemResults,
      message: "Bestellung erfolgreich übermittelt.",
    })
  } catch (error) {
    console.error(
      `Bestell-API: Verarbeitung fehlgeschlagen${orderId ? ` (${orderId})` : ""}.`,
      error
    )
    return NextResponse.json(
      { error: "Interner Serverfehler bei der Bestellung." },
      { status: 500 }
    )
  }
}
