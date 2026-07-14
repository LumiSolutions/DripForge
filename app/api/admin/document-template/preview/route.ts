import { NextResponse } from "next/server"
import {
  getDocumentTemplateSettings,
  getOrderById,
  getSettings,
} from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { generateInvoicePdfBuffer } from "@/lib/invoices/generate-invoice-pdf"
import {
  DOCUMENT_TEMPLATE_TYPES,
  sanitizeDocumentTemplateInput,
  type DocumentTemplateSettings,
  type DocumentTemplateType,
} from "@/lib/documents/document-template-types"
import type { StoredOrder } from "@/lib/admin/types"

function buildPreviewOrder(documentType: DocumentTemplateType): StoredOrder {
  const now = new Date().toISOString()
  const orderId =
    documentType === "quote"
      ? "AN-00001"
      : documentType === "deliveryNote"
        ? "LI-00001"
        : "RE-00001"

  return {
    orderId,
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
    paymentConfirmed: false,
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

function normalizeDocumentType(value: unknown): DocumentTemplateType {
  return DOCUMENT_TEMPLATE_TYPES.includes(value as DocumentTemplateType)
    ? (value as DocumentTemplateType)
    : "invoice"
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json().catch(() => ({}))) as {
      orderId?: string
      documentType?: string
      download?: boolean
      template?: Partial<DocumentTemplateSettings>
    }
    const settings = await getSettings()
    const storedTemplate = await getDocumentTemplateSettings()
    const template = body.template
      ? sanitizeDocumentTemplateInput(body.template, storedTemplate)
      : storedTemplate
    const documentType = normalizeDocumentType(body.documentType)
    const order =
      body.orderId && body.orderId !== "preview"
        ? await getOrderById(body.orderId)
        : buildPreviewOrder(documentType)

    if (!order) {
      return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 })
    }

    const pdfBuffer = await generateInvoicePdfBuffer(
      order,
      settings,
      template,
      documentType
    )
    const label = template.documentTypes[documentType].label
    const filename = `${label}-Vorschau-${order.orderId}.pdf`
    const disposition = body.download === false ? "inline" : "attachment"

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Admin: Dokumentenvorschau fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Dokumentenvorschau konnte nicht erstellt werden." },
      { status: 500 }
    )
  }
}
