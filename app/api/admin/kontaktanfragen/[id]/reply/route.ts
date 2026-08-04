import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import {
  getKontaktanfrageById,
  updateKontaktanfrageStatus,
} from "@/lib/admin/kontaktanfragen-db"
import { getSettings } from "@/lib/admin/db"
import { resolveEmailBranding } from "@/lib/email/order-email-context"
import {
  renderDripForgeEmailHtml,
  textToHtmlParagraphs,
} from "@/lib/email/dripforge-email-layout"
import { resolveSmtpFrom, sendSmtpMail, isSmtpConfigured } from "@/lib/email/smtp"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const anfrageId = id?.trim()
    if (!anfrageId) {
      return NextResponse.json({ error: "ID fehlt." }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as {
      message?: string
      subject?: string
    } | null

    const message = (body?.message ?? "").trim()
    if (!message) {
      return NextResponse.json(
        { error: "Antworttext darf nicht leer sein." },
        { status: 400 }
      )
    }

    const anfrage = await getKontaktanfrageById(anfrageId)
    if (!anfrage) {
      return NextResponse.json({ error: "Anfrage nicht gefunden." }, { status: 404 })
    }
    if (!anfrage.email.trim()) {
      return NextResponse.json(
        { error: "Diese Anfrage hat keine E-Mail-Adresse." },
        { status: 400 }
      )
    }

    if (!isSmtpConfigured()) {
      return NextResponse.json(
        {
          error:
            "SMTP ist nicht konfiguriert (SMTP_USER/SMTP_PASS). E-Mail-Versand nicht möglich.",
        },
        { status: 503 }
      )
    }

    const settings = await getSettings()
    const branding = await resolveEmailBranding(settings)
    const subject =
      (body?.subject ?? "").trim() ||
      `Re: ${anfrage.subject || "Deine Anfrage"} (#${anfrage.id})`

    const plain = [
      `Guten Tag ${anfrage.name},`,
      "",
      message,
      "",
      "Freundliche Grüsse",
      branding.companyName,
      "",
      "———",
      `Bezug: Anfrage ${anfrage.id}${anfrage.subject ? ` — ${anfrage.subject}` : ""}`,
    ].join("\n")

    const sent = await sendSmtpMail({
      from: resolveSmtpFrom(branding.companyName, branding.contactEmail),
      to: anfrage.email,
      subject,
      text: plain,
      html: renderDripForgeEmailHtml({
        title: "Antwort auf deine Anfrage",
        bodyHtml: textToHtmlParagraphs(plain),
        footerLines: branding.footerLines,
        logoUrl: branding.logoUrl ?? undefined,
      }),
    })

    if (!sent) {
      return NextResponse.json(
        { error: "E-Mail konnte nicht gesendet werden (SMTP)." },
        { status: 502 }
      )
    }

    // Nach erfolgreichem Versand als beantwortet markieren.
    const updated = await updateKontaktanfrageStatus(anfrage.id, "beantwortet")

    return NextResponse.json({ ok: true, anfrage: updated ?? anfrage })
  } catch (error) {
    console.error("Admin-API: Kontaktanfrage-Antwort fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Antwort konnte nicht gesendet werden." },
      { status: 500 }
    )
  }
}
