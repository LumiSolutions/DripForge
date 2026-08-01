import { NextResponse } from "next/server"
import { createKontaktanfrage } from "@/lib/admin/kontaktanfragen-db"
import {
  createKontaktanfrageId,
  isValidKontaktEmail,
  parseKontaktInquiryType,
} from "@/lib/admin/kontaktanfrage-types"
import { notifyAdminNewKontaktanfrage } from "@/lib/email/admin-inbound-notifications"
import { notifyKontaktanfrageReceived } from "@/lib/email/order-notifications"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_NAME_LENGTH = 120
const MAX_SUBJECT_LENGTH = 200
const MAX_MESSAGE_LENGTH = 8000
const MAX_COMPANY_LENGTH = 120

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string
      email?: string
      phone?: string
      telefon?: string
      company?: string
      inquiryType?: string
      subject?: string
      message?: string
      extraFields?: Record<string, string>
    }

    const name = body.name?.trim() ?? ""
    const email = body.email?.trim() ?? ""
    const phone = (body.phone ?? body.telefon)?.trim() ?? ""
    const company = body.company?.trim() ?? ""
    const subject = body.subject?.trim() ?? ""
    const message = body.message?.trim() ?? ""
    const inquiryType = parseKontaktInquiryType(body.inquiryType)
    const extraFields =
      body.extraFields && typeof body.extraFields === "object"
        ? Object.fromEntries(
            Object.entries(body.extraFields)
              .filter(
                ([, value]) => typeof value === "string" && value.trim().length > 0
              )
              .map(([key, value]) => [key, String(value).slice(0, 200_000)])
          )
        : undefined

    if (!name) {
      return NextResponse.json({ error: "Bitte geben Sie Ihren Namen an." }, { status: 400 })
    }
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: "Der Name ist zu lang." }, { status: 400 })
    }
    if (!email || !isValidKontaktEmail(email)) {
      return NextResponse.json(
        { error: "Bitte geben Sie eine gültige E-Mail-Adresse an." },
        { status: 400 }
      )
    }
    if (!inquiryType) {
      return NextResponse.json(
        { error: "Bitte wählen Sie einen Anfrage-Typ." },
        { status: 400 }
      )
    }
    if (!subject) {
      return NextResponse.json({ error: "Bitte geben Sie einen Betreff an." }, { status: 400 })
    }
    if (subject.length > MAX_SUBJECT_LENGTH) {
      return NextResponse.json({ error: "Der Betreff ist zu lang." }, { status: 400 })
    }
    if (!message) {
      return NextResponse.json({ error: "Bitte geben Sie eine Nachricht ein." }, { status: 400 })
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "Die Nachricht ist zu lang." }, { status: 400 })
    }
    if (company.length > MAX_COMPANY_LENGTH) {
      return NextResponse.json({ error: "Der Firmenname ist zu lang." }, { status: 400 })
    }

    const anfrage = await createKontaktanfrage(
      {
        name,
        email,
        phone: phone || undefined,
        company: company || undefined,
        inquiryType,
        subject,
        message,
        extraFields,
        status: "offen",
      },
      createKontaktanfrageId()
    )

    const results = await Promise.allSettled([
      notifyAdminNewKontaktanfrage(anfrage),
      notifyKontaktanfrageReceived(anfrage),
    ])
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          `[Kontakt] Benachrichtigung fehlgeschlagen (${anfrage.id}).`,
          result.reason
        )
      }
    }

    return NextResponse.json({
      ok: true,
      anfrageId: anfrage.id,
      message:
        "Vielen Dank — Ihre Nachricht wurde übermittelt. Wir melden uns so schnell wie möglich.",
    })
  } catch (error) {
    console.error("[Kontakt] Speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Ihre Nachricht konnte nicht gesendet werden." },
      { status: 500 }
    )
  }
}
