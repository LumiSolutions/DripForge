import { NextResponse } from "next/server"
import {
  cosmosCreateJournalEntry,
  cosmosGetJournalEntries,
} from "@/lib/admin/cosmos-journal"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import {
  normalizeJournalLine,
  validateJournalEntryLines,
  type JournalLine,
} from "@/lib/accounting/journal-types"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const url = new URL(request.url)
    const limit = Math.min(
      200,
      Math.max(1, Number(url.searchParams.get("limit") ?? 50))
    )
    const entries = await cosmosGetJournalEntries(limit)
    return NextResponse.json({ entries })
  } catch (error) {
    console.error("Admin-API: Journal konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Journal konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as {
      date?: string
      belegNummer?: string
      description?: string
      lines?: JournalLine[]
    }

    const date = body.date?.trim()
    const description = body.description?.trim()
    if (!date) {
      return NextResponse.json({ error: "Buchungsdatum fehlt." }, { status: 400 })
    }
    if (!description) {
      return NextResponse.json({ error: "Buchungstext fehlt." }, { status: 400 })
    }

    const lines = (body.lines ?? []).map(normalizeJournalLine)
    const validation = validateJournalEntryLines(lines)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const entry = await cosmosCreateJournalEntry({
      date,
      belegNummer: body.belegNummer?.trim(),
      description,
      lines,
      source: "manual",
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    console.error("Admin-API: Buchung konnte nicht gespeichert werden.", error)
    const message =
      error instanceof Error ? error.message : "Buchung konnte nicht gespeichert werden."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
