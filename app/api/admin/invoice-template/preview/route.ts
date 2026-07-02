import { NextResponse } from "next/server"
import {
  getInvoiceTemplateSettings,
  getOrderById,
  getSettings,
} from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { generateInvoicePdfBuffer } from "@/lib/invoices/generate-invoice-pdf"
import type { StoredOrder } from "@/lib/admin/types"

function buildPreviewOrder(): StoredOrder {
  const now = new Date().toISOString()
  return {
    orderId: "df-preview-0001",
    createdAt: now,
    status: "ausstehend",
    productionStatus: "bereit_fuer_produktion",
    kundennummer: "K-00042",
    billing: {
      firstName: "Max",
      lastName: "Muster",
      email: "max@muster.ch",
      street: "Musterstrasse 12",
      zip: "8000",
      city: "Zuerich",
      country: "Schweiz",
      phone: "+41 79 000 00 00",
    },
    delivery: {
      firstName: "Max",
      lastName: "Muster",
      email: "max@muster.ch",
      street: "Musterstrasse 12",
      zip: "8000",
      city: "Zuerich",
      country: "Schweiz",
      phone: "+41 79 000 00 00",
    },
    shippingMethod: "apost",
    paymentMethod: "invoice",
    paymentMethodLabel: "Kauf auf Rechnung",
    paymentConfirmed: true,
    items: [
      {
        id: "preview-3d",
        name: "3D-Druck Prototyp",
        price: 45.5,
        quantity: 2,
        type: "3d",
        customDetails: {
          filament: "PLA",
          color: "Schwarz",
          dimensions: "80 x 60 x 25 mm",
          fileName: "gehaeuse.stl",
        },
      },
      {
        id: "preview-laser",
        name: "Lasergravur Holz",
        price: 28.0,
        quantity: 1,
        type: "laser",
        customDetails: {
          material: "Birke",
          engravingText: "DripForge 2026",
        },
      },
    ],
    totals: {
      subtotal: 119.0,
      shippingCost: 9.0,
      discountAmount: 0,
      vat: 0,
      total: 128.0,
      mwstAktiv: false,
    },
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json().catch(() => ({}))) as { orderId?: string }
    const settings = await getSettings()
    const template = await getInvoiceTemplateSettings()
    const order =
      body.orderId && body.orderId !== "preview"
        ? await getOrderById(body.orderId)
        : buildPreviewOrder()

    if (!order) {
      return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 })
    }

    const pdfBuffer = await generateInvoicePdfBuffer(order, settings, template)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Rechnung-Vorschau.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Admin: Rechnungsvorschau fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Rechnungsvorschau konnte nicht erstellt werden." },
      { status: 500 }
    )
  }
}
