import { NextResponse } from "next/server"
import { cosmosFindBelegByActionToken } from "@/lib/admin/cosmos-belege"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"
import {
  BELEG_TYPE_LABELS,
  OFFERTE_STATUS_LABELS,
  normalizeOfferteStatus,
  type OfferteStatus,
} from "@/lib/documents/beleg-types"
import { formatChf, formatInvoiceDate } from "@/lib/invoices/invoice-format"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Ctx = { params: Promise<{ token: string }> }

function canCustomerRespond(status: OfferteStatus): boolean {
  return status === "gesendet" || status === "verbucht"
}

export async function GET(_request: Request, context: Ctx) {
  try {
    await warmCosmosInfrastructure()
    const { token } = await context.params
    const beleg = await cosmosFindBelegByActionToken(decodeURIComponent(token))
    if (!beleg || beleg.type !== "offerte") {
      return NextResponse.json({ error: "Offerte nicht gefunden." }, { status: 404 })
    }

    const status = normalizeOfferteStatus(String(beleg.status))
    return NextResponse.json({
      offerte: {
        id: beleg.id,
        type: beleg.type,
        typeLabel: BELEG_TYPE_LABELS.offerte,
        status,
        statusLabel: OFFERTE_STATUS_LABELS[status] ?? status,
        createdAt: beleg.createdAt,
        createdAtLabel: formatInvoiceDate(beleg.createdAt),
        kunde: {
          firstName: beleg.kunde.firstName,
          lastName: beleg.kunde.lastName,
          company: beleg.kunde.company ?? null,
          email: beleg.kunde.email,
        },
        positionen: beleg.positionen.map((pos) => ({
          name: pos.name,
          details: pos.details ?? null,
          quantity: pos.quantity,
          unit: pos.unit,
          unitPrice: pos.unitPrice,
          lineTotal: pos.lineTotal,
        })),
        subtotal: beleg.subtotal,
        vatTotal: beleg.vatTotal,
        total: beleg.total,
        totalLabel: formatChf(beleg.total),
        notes: beleg.notes ?? null,
        customerResponseRemark: beleg.customerResponseRemark ?? null,
        customerRespondedAt: beleg.customerRespondedAt ?? null,
        canRespond: canCustomerRespond(status),
      },
    })
  } catch (error) {
    console.error("Public Offerte GET fehlgeschlagen.", formatCosmosError(error))
    return NextResponse.json(
      { error: "Offerte konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}
