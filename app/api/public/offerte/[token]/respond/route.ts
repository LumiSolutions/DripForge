import { NextResponse } from "next/server"
import {
  cosmosFindBelegByActionToken,
  cosmosUpsertBeleg,
} from "@/lib/admin/cosmos-belege"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"
import {
  OFFERTE_STATUS_LABELS,
  normalizeOfferteStatus,
  type OfferteStatus,
} from "@/lib/documents/beleg-types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Ctx = { params: Promise<{ token: string }> }

function canCustomerRespond(status: OfferteStatus): boolean {
  return status === "gesendet" || status === "verbucht"
}

export async function POST(request: Request, context: Ctx) {
  try {
    await warmCosmosInfrastructure()
    const { token } = await context.params
    const beleg = await cosmosFindBelegByActionToken(decodeURIComponent(token))
    if (!beleg || beleg.type !== "offerte") {
      return NextResponse.json({ error: "Offerte nicht gefunden." }, { status: 404 })
    }

    const status = normalizeOfferteStatus(String(beleg.status))
    if (!canCustomerRespond(status)) {
      return NextResponse.json(
        {
          error: `Diese Offerte kann nicht mehr beantwortet werden (Status: ${OFFERTE_STATUS_LABELS[status]}).`,
        },
        { status: 409 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: string
      remark?: string
    }
    const action = String(body.action ?? "").trim().toLowerCase()
    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { error: "Ungültige Aktion. Erwartet: accept oder reject." },
        { status: 400 }
      )
    }

    const remark = String(body.remark ?? "").trim()
    if (action === "reject" && !remark) {
      return NextResponse.json(
        { error: "Bei Ablehnung ist eine Bemerkung erforderlich." },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const nextStatus: OfferteStatus =
      action === "accept" ? "angenommen" : "abgelehnt"

    const saved = await cosmosUpsertBeleg({
      ...beleg,
      status: nextStatus,
      customerResponseRemark: remark || null,
      customerRespondedAt: now,
      updatedAt: now,
    })

    return NextResponse.json({
      ok: true,
      status: nextStatus,
      statusLabel: OFFERTE_STATUS_LABELS[nextStatus],
      customerResponseRemark: saved.customerResponseRemark ?? null,
      customerRespondedAt: saved.customerRespondedAt ?? null,
    })
  } catch (error) {
    console.error(
      "Public Offerte respond fehlgeschlagen.",
      formatCosmosError(error)
    )
    return NextResponse.json(
      { error: "Antwort konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
