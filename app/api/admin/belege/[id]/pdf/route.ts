import { NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"
import { cosmosGetBelegById, cosmosUpsertBeleg } from "@/lib/admin/cosmos-belege"
import { getDocumentTemplateSettings, getSettings } from "@/lib/admin/db"
import { belegToSyntheticOrder } from "@/lib/documents/beleg-to-order"
import { belegTypeToDocumentTemplateType } from "@/lib/documents/beleg-types"
import { generateInvoicePdfBuffer } from "@/lib/invoices/generate-invoice-pdf"
import { storeOrderInvoicePdf } from "@/lib/invoices/store-order-invoice"

function isAuthError(value: unknown): value is NextResponse {
  return value instanceof NextResponse
}

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Ctx) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const { id } = await context.params
    const beleg = await cosmosGetBelegById(decodeURIComponent(id))
    if (!beleg) {
      return NextResponse.json({ error: "Beleg nicht gefunden." }, { status: 404 })
    }

    const [settings, template] = await Promise.all([
      getSettings(),
      getDocumentTemplateSettings(),
    ])
    const order = belegToSyntheticOrder(beleg)
    const documentType = belegTypeToDocumentTemplateType(beleg.type)
    const pdfBuffer = await generateInvoicePdfBuffer(
      order,
      settings,
      template,
      documentType
    )

    try {
      const stored = await storeOrderInvoicePdf(beleg.id, pdfBuffer)
      if (stored.rechnungPdfUrl) {
        await cosmosUpsertBeleg({
          ...beleg,
          pdfUrl: stored.rechnungPdfUrl,
          updatedAt: new Date().toISOString(),
        })
      }
    } catch (storeError) {
      console.warn("Beleg-PDF: Speichern optional fehlgeschlagen.", storeError)
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${beleg.id}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Beleg PDF fehlgeschlagen.", formatCosmosError(error))
    return NextResponse.json(
      { error: "PDF konnte nicht erzeugt werden." },
      { status: 500 }
    )
  }
}
