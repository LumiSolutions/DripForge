import { NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"
import {
  cosmosDeleteBeleg,
  cosmosGetBelegById,
  cosmosUpsertBeleg,
} from "@/lib/admin/cosmos-belege"
import { recordBelegPaymentJournalEntry } from "@/lib/accounting/beleg-journal"
import { normalizeBeleg, normalizeBelegAddress } from "@/lib/documents/beleg-types"
import { upsertCustomerFromBelegAddress } from "@/lib/admin/upsert-customer-from-beleg"

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
    return NextResponse.json({ beleg })
  } catch (error) {
    console.error("Beleg GET fehlgeschlagen.", formatCosmosError(error))
    return NextResponse.json({ error: "Beleg konnte nicht geladen werden." }, { status: 500 })
  }
}

export async function PUT(request: Request, context: Ctx) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const { id } = await context.params
    const existing = await cosmosGetBelegById(decodeURIComponent(id))
    if (!existing) {
      return NextResponse.json({ error: "Beleg nicht gefunden." }, { status: 404 })
    }

    const body = (await request.json()) as Partial<typeof existing>
    const kunde = body.kunde
      ? normalizeBelegAddress(body.kunde)
      : existing.kunde

    let customerId =
      body.customerId !== undefined ? body.customerId : existing.customerId
    try {
      customerId = await upsertCustomerFromBelegAddress(kunde, customerId)
    } catch (customerError) {
      console.warn(
        "Beleg PUT: Kunden-Upsert fehlgeschlagen.",
        formatCosmosError(customerError)
      )
    }

    const beleg = normalizeBeleg(
      {
        ...existing,
        ...body,
        id: existing.id,
        type: existing.type,
        kunde,
        customerId,
      },
      existing
    )
    const saved = await cosmosUpsertBeleg(beleg)
    try {
      await recordBelegPaymentJournalEntry(saved)
    } catch (journalError) {
      console.warn(
        "Beleg gespeichert, aber Buchhaltungseintrag fehlgeschlagen.",
        formatCosmosError(journalError)
      )
    }
    return NextResponse.json({ beleg: saved })
  } catch (error) {
    console.error("Beleg PUT fehlgeschlagen.", formatCosmosError(error))
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Beleg konnte nicht gespeichert werden.",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: Ctx) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const { id } = await context.params
    const ok = await cosmosDeleteBeleg(decodeURIComponent(id))
    if (!ok) {
      return NextResponse.json({ error: "Beleg nicht gefunden." }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Beleg DELETE fehlgeschlagen.", formatCosmosError(error))
    return NextResponse.json({ error: "Beleg konnte nicht gelöscht werden." }, { status: 500 })
  }
}
