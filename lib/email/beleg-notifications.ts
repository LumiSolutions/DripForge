import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { getSettings } from "@/lib/admin/db"
import type { AdminSettings } from "@/lib/admin/types"
import {
  BELEG_TYPE_LABELS,
  type Beleg,
} from "@/lib/documents/beleg-types"
import {
  renderDripForgeEmailHtml,
  renderEmailCtaButton,
  renderOrderItemsTableHtml,
  textToHtmlParagraphs,
} from "@/lib/email/dripforge-email-layout"
import { resolveEmailBranding } from "@/lib/email/order-email-context"
import { resolveAdminNotifyEmail } from "@/lib/email/resolve-admin-notify-email"
import { resolveSmtpFrom, sendSmtpMail } from "@/lib/email/smtp"
import { formatChf, formatInvoiceDate } from "@/lib/invoices/invoice-format"
import { resolveSiteOrigin } from "@/lib/site/site-origin"

function buildAdminBelegDetailUrl(belegId: string): string {
  return `${resolveSiteOrigin()}${adminPortalPath("/belege")}?beleg=${encodeURIComponent(belegId)}`
}

function customerNameFromBeleg(beleg: Beleg): string {
  const name = `${beleg.kunde.firstName} ${beleg.kunde.lastName}`.trim()
  return name || beleg.kunde.company?.trim() || "dort"
}

function formatBelegPositionsPlain(beleg: Beleg): string {
  const lines = beleg.positionen.map((pos, index) => {
    const qty = `${pos.quantity} ${pos.unit}`.trim()
    const detail = pos.details?.trim() ? ` — ${pos.details.trim()}` : ""
    return `${index + 1}. ${pos.name}${detail} (${qty}, ${formatChf(pos.lineTotal)})`
  })
  return [
    ...lines,
    "",
    `Zwischensumme: ${formatChf(beleg.subtotal)}`,
    beleg.vatTotal > 0 ? `MwSt.: ${formatChf(beleg.vatTotal)}` : null,
    `Gesamtbetrag: ${formatChf(beleg.total)}`,
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * Kunden-Bestätigung bei neuer / freigegebener Offerte.
 * to: customer.email (beleg.kunde.email)
 */
export async function notifyOfferteReceived(
  beleg: Beleg,
  settings?: AdminSettings
): Promise<boolean> {
  if (beleg.type !== "offerte") return false
  const to = beleg.kunde.email?.trim()
  if (!to) {
    console.info(
      `E-Mail: Offerten-Bestätigung übersprungen — keine Kunden-E-Mail (${beleg.id}).`
    )
    return false
  }

  try {
    const adminSettings = settings ?? (await getSettings())
    const branding = await resolveEmailBranding(adminSettings)
    const customerName = customerNameFromBeleg(beleg)
    const label = BELEG_TYPE_LABELS.offerte
    const subject = `${label} ${beleg.id} — DripForge`

    const plain = [
      `Guten Tag ${customerName},`,
      "",
      `vielen Dank für Ihre Anfrage — anbei die Zusammenfassung Ihrer ${label}.`,
      "",
      `${label}-Nr.: ${beleg.id}`,
      `Datum: ${formatInvoiceDate(beleg.createdAt)}`,
      `Status: ${beleg.status}`,
      "",
      "Positionen:",
      formatBelegPositionsPlain(beleg),
      "",
      "Bei Fragen antworten Sie einfach auf diese E-Mail.",
      "",
      "Freundliche Grüsse",
      branding.companyName,
    ].join("\n")

    const html = renderDripForgeEmailHtml({
      title: `${label} ${beleg.id}`,
      bodyHtml:
        textToHtmlParagraphs(
          [
            `Guten Tag ${customerName},`,
            "",
            `vielen Dank für Ihre Anfrage — anbei die Zusammenfassung Ihrer ${label}.`,
            "",
            `${label}-Nr.: ${beleg.id}`,
            `Datum: ${formatInvoiceDate(beleg.createdAt)}`,
          ].join("\n")
        ) +
        renderOrderItemsTableHtml(
          beleg.positionen.map((pos) => ({
            name: pos.name,
            quantity: pos.quantity,
            price: pos.unitPrice,
          }))
        ) +
        textToHtmlParagraphs(
          [
            `Gesamtbetrag: ${formatChf(beleg.total)}`,
            "",
            "Bei Fragen antworten Sie einfach auf diese E-Mail.",
          ].join("\n")
        ),
      footerLines: branding.footerLines,
      logoUrl: branding.logoUrl ?? undefined,
    })

    const sent = await sendSmtpMail({
      from: resolveSmtpFrom(branding.companyName, branding.contactEmail),
      to,
      subject,
      text: plain,
      html,
    })

    if (sent) {
      console.info(`E-Mail: Offerten-Bestätigung gesendet (${beleg.id} → ${to}).`)
    }
    return sent
  } catch (error) {
    console.error(
      `E-Mail: Offerten-Bestätigung fehlgeschlagen (${beleg.id}).`,
      error
    )
    return false
  }
}

/**
 * Admin-Benachrichtigung bei neuer / freigegebener Offerte.
 * to: shop@dripforge.ch (via resolveAdminNotifyEmail)
 */
export async function notifyAdminNewOfferte(
  beleg: Beleg,
  settings?: AdminSettings
): Promise<boolean> {
  if (beleg.type !== "offerte") return false

  try {
    const adminSettings = settings ?? (await getSettings())
    const to = resolveAdminNotifyEmail(adminSettings) || "shop@dripforge.ch"
    const branding = await resolveEmailBranding(adminSettings)
    const dashboardUrl = buildAdminBelegDetailUrl(beleg.id)
    const customerName = customerNameFromBeleg(beleg)
    const subject = `🚨 Neue Offerte erstellt! #${beleg.id}`

    const plainBody = [
      "Es wurde eine neue Offerte erstellt bzw. freigegeben.",
      "",
      `Kunde: ${customerName}`,
      `E-Mail: ${beleg.kunde.email || "—"}`,
      `Offerten-Nr.: ${beleg.id}`,
      `Status: ${beleg.status}`,
      `Datum: ${formatInvoiceDate(beleg.createdAt)}`,
      `Gesamtbetrag: ${formatChf(beleg.total)}`,
      "",
      "Positionen:",
      formatBelegPositionsPlain(beleg),
      "",
      `Im Admin-Dashboard öffnen: ${dashboardUrl}`,
    ].join("\n")

    const html = renderDripForgeEmailHtml({
      title: "Neue Offerte",
      bodyHtml:
        textToHtmlParagraphs(plainBody) +
        renderEmailCtaButton(dashboardUrl, "Im Admin-Dashboard öffnen"),
      footerLines: branding.footerLines,
      logoUrl: branding.logoUrl ?? undefined,
    })

    const sent = await sendSmtpMail({
      from: resolveSmtpFrom(branding.companyName, branding.contactEmail),
      to,
      subject,
      text: plainBody,
      html,
    })

    if (sent) {
      console.info(
        `E-Mail: Admin-Offerten-Benachrichtigung gesendet (${beleg.id} → ${to}).`
      )
    }
    return sent
  } catch (error) {
    console.error(
      `E-Mail: Admin-Offerten-Benachrichtigung fehlgeschlagen (${beleg.id}).`,
      error
    )
    return false
  }
}

/**
 * True, wenn Offerten-Mails versendet werden sollen:
 * - Neu erstellt und nicht mehr «entwurf»
 * - Statuswechsel von «entwurf» → «offen» / «angenommen»
 */
export function shouldSendOfferteEmails(
  previous: Beleg | null,
  next: Beleg
): boolean {
  if (next.type !== "offerte") return false
  if (!next.kunde.email?.trim()) return false

  if (!previous) {
    return next.status !== "entwurf"
  }

  if (previous.status === "entwurf" && next.status !== "entwurf") {
    return true
  }

  return false
}

/** Kunden- + Admin-Mails bei Offerte — Fehler brechen den Speichervorgang nie ab. */
export async function sendInboundOfferteEmailsSafe(
  beleg: Beleg,
  settings?: AdminSettings
): Promise<void> {
  console.log("[OfferteEmail] Starte Benachrichtigungen", {
    belegId: beleg.id,
    customerEmail: beleg.kunde.email,
    status: beleg.status,
  })

  try {
    const results = await Promise.allSettled([
      notifyOfferteReceived(beleg, settings),
      notifyAdminNewOfferte(beleg, settings),
    ])
    results.forEach((result, index) => {
      const label = index === 0 ? "customer" : "admin"
      if (result.status === "fulfilled") {
        console.log(`[OfferteEmail] ${label}: settled ok`, {
          belegId: beleg.id,
          sent: result.value,
        })
      } else {
        console.error(`[OfferteEmail] ${label}: rejected`, {
          belegId: beleg.id,
          reason: result.reason,
        })
      }
    })
  } catch (error) {
    console.error(`[OfferteEmail] Unerwarteter Fehler (${beleg.id}).`, error)
  }
}
