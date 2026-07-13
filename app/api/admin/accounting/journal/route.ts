import { NextResponse } from "next/server"
import {
  cosmosCreateJournalEntry,
  cosmosGetJournalEntries,
} from "@/lib/admin/cosmos-journal"
import { cosmosGetTaxCodes } from "@/lib/admin/cosmos-tax-codes"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import {
  defaultBookingDescription,
  manualRowsToJournalLines,
  normalizeManualBookingRow,
  stripAttachmentPayload,
  validateManualBookingRows,
  type ManualBookingRow,
} from "@/lib/accounting/manual-booking"
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
      500,
      Math.max(1, Number(url.searchParams.get("limit") ?? 100))
    )
    const from = url.searchParams.get("from")?.trim() || undefined
    const to = url.searchParams.get("to")?.trim() || undefined
    const sourceParam = url.searchParams.get("source")
    const source =
      sourceParam === "manual" || sourceParam === "order" ? sourceParam : undefined

    const entries = await cosmosGetJournalEntries({ limit, from, to, source })
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
      rows?: ManualBookingRow[]
    }

    const date = body.date?.trim()
    if (!date) {
      return NextResponse.json({ error: "Buchungsdatum fehlt." }, { status: 400 })
    }

    let lines: JournalLine[] = []
    let bookingRows: ManualBookingRow[] | undefined
    let description = body.description?.trim() ?? ""

    if (body.rows?.length) {
      let taxCodes: Awaited<ReturnType<typeof cosmosGetTaxCodes>> = []
      try {
        taxCodes = await cosmosGetTaxCodes()
      } catch (taxError) {
        console.error("Admin-API: Steuercodes für Buchung nicht geladen.", taxError)
        taxCodes = []
      }

      bookingRows = body.rows.map((row) =>
        stripAttachmentPayload(normalizeManualBookingRow(row, taxCodes))
      )
      const rowValidation = validateManualBookingRows(bookingRows)
      if (!rowValidation.valid) {
        return NextResponse.json(
          { error: rowValidation.error ?? "Buchungszeilen ungültig." },
          { status: 400 }
        )
      }
      lines = manualRowsToJournalLines(bookingRows)
      if (!description) {
        description = defaultBookingDescription(bookingRows)
      }
    } else if (body.lines?.length) {
      lines = body.lines.map(normalizeJournalLine)
    } else {
      return NextResponse.json(
        { error: "Keine Buchungszeilen (rows) oder lines übergeben." },
        { status: 400 }
      )
    }

    if (!description) {
      description = "Manuelle Buchung"
    }

    const validation = validateJournalEntryLines(lines)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const entry = await cosmosCreateJournalEntry({
      date,
      belegNummer: body.belegNummer?.trim(),
      description,
      lines,
      bookingRows,
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
