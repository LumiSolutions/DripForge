import { NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"
import { cosmosListBelege, cosmosUpsertBeleg } from "@/lib/admin/cosmos-belege"
import { recordBelegPaymentJournalEntry } from "@/lib/accounting/beleg-journal"
import {
  createBelegDraft,
  ensureOfferteActionToken,
} from "@/lib/documents/beleg-service"
import {
  emptyBelegAddress,
  type BelegEmailAttachment,
  type BelegType,
} from "@/lib/documents/beleg-types"
import {
  sendInboundOfferteEmailsSafe,
  shouldSendOfferteEmails,
} from "@/lib/email/beleg-notifications"

function isAuthError(value: unknown): value is NextResponse {
  return value instanceof NextResponse
}

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") as BelegType | null
    const belege = await cosmosListBelege({
      type: type === "offerte" || type === "rechnung" || type === "lieferschein" ? type : undefined,
    })
    return NextResponse.json({ belege })
  } catch (error) {
    console.error("Belege GET fehlgeschlagen.", formatCosmosError(error))
    return NextResponse.json({ error: "Belege konnten nicht geladen werden." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as {
      type?: BelegType
      status?: string
      kunde?: Record<string, string>
      lieferAdresse?: Record<string, string>
      positionen?: Array<Record<string, unknown>>
      notes?: string
      customerId?: string | null
      emailAttachments?: BelegEmailAttachment[]
    }

    const type = body.type
    if (type !== "offerte" && type !== "rechnung" && type !== "lieferschein") {
      return NextResponse.json({ error: "Ungültiger Belegtyp." }, { status: 400 })
    }

    let beleg = await createBelegDraft({
      type,
      status: body.status as never,
      kunde: { ...emptyBelegAddress(), ...(body.kunde ?? {}) },
      lieferAdresse: body.lieferAdresse
        ? { ...emptyBelegAddress(), ...body.lieferAdresse }
        : undefined,
      positionen: Array.isArray(body.positionen) ? body.positionen : [],
      notes: body.notes,
      customerId: body.customerId ?? null,
      emailAttachments: Array.isArray(body.emailAttachments)
        ? body.emailAttachments
        : undefined,
    })

    const withToken = ensureOfferteActionToken(beleg)
    if (withToken.actionToken !== beleg.actionToken) {
      beleg = await cosmosUpsertBeleg(withToken)
    }

    try {
      await recordBelegPaymentJournalEntry(beleg)
    } catch (journalError) {
      console.warn(
        "Beleg erstellt, aber Buchhaltungseintrag fehlgeschlagen.",
        formatCosmosError(journalError)
      )
    }

    if (shouldSendOfferteEmails(null, beleg)) {
      void sendInboundOfferteEmailsSafe(beleg)
    }

    return NextResponse.json({ beleg }, { status: 201 })
  } catch (error) {
    console.error("Belege POST fehlgeschlagen.", formatCosmosError(error))
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Beleg konnte nicht erstellt werden.",
      },
      { status: 500 }
    )
  }
}
