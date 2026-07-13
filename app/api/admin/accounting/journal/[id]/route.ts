import { NextResponse } from "next/server"
import {
  cosmosGetJournalEntryById,
  cosmosUpdateJournalEntry,
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

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const decoded = decodeURIComponent(id).trim()
    if (!decoded) {
      return NextResponse.json({ error: "Buchungs-ID fehlt." }, { status: 400 })
    }

    const entry = await cosmosGetJournalEntryById(decoded)
    if (!entry) {
      return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
    }

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Admin-API: Buchung konnte nicht geladen werden.", error)
    const message =
      error instanceof Error ? error.message : "Buchung konnte nicht geladen werden."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const decoded = decodeURIComponent(id).trim()
    if (!decoded) {
      return NextResponse.json({ error: "Buchungs-ID fehlt." }, { status: 400 })
    }

    const existing = await cosmosGetJournalEntryById(decoded)
    if (!existing) {
      return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
    }

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
        console.error("Admin-API: Steuercodes für Update nicht geladen.", taxError)
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
      description = existing.description || "Manuelle Buchung"
    }

    const validation = validateJournalEntryLines(lines)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const entry = await cosmosUpdateJournalEntry(decoded, {
      date,
      belegNummer: body.belegNummer?.trim(),
      description,
      lines,
      bookingRows,
    })

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Admin-API: Buchung konnte nicht aktualisiert werden.", error)
    const message =
      error instanceof Error
        ? error.message
        : "Buchung konnte nicht aktualisiert werden."
    const status = message === "Buchung nicht gefunden." ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
