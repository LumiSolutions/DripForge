import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { getSettings } from "@/lib/admin/db"
import type { AdminSettings } from "@/lib/admin/types"
import {
  BELEG_TYPE_LABELS,
  OFFERTE_STATUS_LABELS,
  normalizeOfferteStatus,
  type Beleg,
  type BelegEmailAttachment,
  type OfferteStatus,
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
import type Mail from "nodemailer/lib/mailer"

function buildAdminBelegDetailUrl(belegId: string): string {
  return `${resolveSiteOrigin()}${adminPortalPath("/belege")}?beleg=${encodeURIComponent(belegId)}`
}

function buildOfferteActionUrl(token: string): string {
  return `${resolveSiteOrigin()}/offerte/${encodeURIComponent(token)}`
}

function customerNameFromBeleg(beleg: Beleg): string {
  const name = `${beleg.kunde.firstName} ${beleg.kunde.lastName}`.trim()
  return name || beleg.kunde.company?.trim() || "dort"
}

function offerteStatusLabel(status: string): string {
  const normalized = normalizeOfferteStatus(status)
  return OFFERTE_STATUS_LABELS[normalized as OfferteStatus] ?? status
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

async function resolveAttachmentContent(
  attachment: BelegEmailAttachment
): Promise<Mail.Attachment | null> {
  const url = attachment.url?.trim()
  if (!url) return null

  try {
    if (url.startsWith("data:")) {
      const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(url)
      if (!match) return null
      return {
        filename: attachment.fileName,
        content: Buffer.from(match[2]!, "base64"),
        contentType: match[1] || attachment.mimeType || "application/octet-stream",
      }
    }

    const res = await fetch(url)
    if (!res.ok) {
      console.warn(
        `Offerte-Anhang konnte nicht geladen werden (${attachment.fileName}): HTTP ${res.status}`
      )
      return null
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType =
      res.headers.get("content-type") ||
      attachment.mimeType ||
      "application/octet-stream"
    return {
      filename: attachment.fileName,
      content: buffer,
      contentType,
    }
  } catch (error) {
    console.warn(
      `Offerte-Anhang fehlgeschlagen (${attachment.fileName}).`,
      error
    )
    return null
  }
}

async function buildSmtpAttachments(
  attachments: BelegEmailAttachment[] | undefined
): Promise<Mail.Attachment[]> {
  if (!attachments?.length) return []
  const resolved = await Promise.all(
    attachments.map((att) => resolveAttachmentContent(att))
  )
  return resolved.filter((att): att is Mail.Attachment => Boolean(att))
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
    const actionUrl = beleg.actionToken
      ? buildOfferteActionUrl(beleg.actionToken)
      : null
    const statusLabel = offerteStatusLabel(String(beleg.status))

    const plain = [
      `Guten Tag ${customerName},`,
      "",
      `vielen Dank für Ihre Anfrage — anbei die Zusammenfassung Ihrer ${label}.`,
      "",
      `${label}-Nr.: ${beleg.id}`,
      `Datum: ${formatInvoiceDate(beleg.createdAt)}`,
      `Status: ${statusLabel}`,
      "",
      "Positionen:",
      formatBelegPositionsPlain(beleg),
      "",
      actionUrl
        ? [
            "Sie können diese Offerte online annehmen oder ablehnen:",
            actionUrl,
            "",
          ].join("\n")
        : null,
      "Bei Fragen antworten Sie einfach auf diese E-Mail.",
      "",
      "Freundliche Grüsse",
      branding.companyName,
    ]
      .filter((line) => line != null)
      .join("\n")

    const ctaHtml = actionUrl
      ? `<div style="margin:20px 0;">
           ${renderEmailCtaButton(actionUrl + "?action=accept", "Offerte annehmen")}
           ${renderEmailCtaButton(actionUrl + "?action=reject", "Offerte ablehnen")}
           <p style="margin:8px 0 0;text-align:center;font-size:13px;color:#6b7280;">
             <a href="${actionUrl}" style="color:#ea580c;">Oder Offerte im Browser öffnen</a>
           </p>
         </div>`
      : ""

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
            `Status: ${statusLabel}`,
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
          [`Gesamtbetrag: ${formatChf(beleg.total)}`].join("\n")
        ) +
        ctaHtml +
        textToHtmlParagraphs(
          "Bei Fragen antworten Sie einfach auf diese E-Mail."
        ),
      footerLines: branding.footerLines,
      logoUrl: branding.logoUrl ?? undefined,
    })

    const attachments = await buildSmtpAttachments(beleg.emailAttachments)

    const sent = await sendSmtpMail({
      from: resolveSmtpFrom(branding.companyName, branding.contactEmail),
      to,
      subject,
      text: plain,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
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
    const statusLabel = offerteStatusLabel(String(beleg.status))

    const plainBody = [
      "Es wurde eine neue Offerte erstellt bzw. freigegeben.",
      "",
      `Kunde: ${customerName}`,
      `E-Mail: ${beleg.kunde.email || "—"}`,
      `Offerten-Nr.: ${beleg.id}`,
      `Status: ${statusLabel}`,
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
 * - Statuswechsel von «entwurf» → anderer Status
 * - Statuswechsel auf «gesendet»
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

  if (next.status === "gesendet" && previous.status !== "gesendet") {
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
    hasToken: Boolean(beleg.actionToken),
    attachmentCount: beleg.emailAttachments?.length ?? 0,
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
