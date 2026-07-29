import {
  getDocumentTemplateSettings,
  getOrderById,
  getSettings,
  updateOrderEmailNotifications,
} from "@/lib/admin/db"
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import {
  KONTAKT_INQUIRY_LABELS,
  type Kontaktanfrage,
} from "@/lib/admin/kontaktanfrage-types"
import {
  renderDripForgeEmailHtml,
  renderEmailCtaButton,
  renderOrderItemsTableHtml,
  textToHtmlParagraphs,
} from "@/lib/email/dripforge-email-layout"
import { resolveEmailBranding } from "@/lib/email/order-email-context"
import {
  formatOrderAddressBlock,
  formatOrderSummaryPlain,
  formatOrderTotalsBlock,
  resolvePaymentStatusLabel,
  resolveShippingLabel,
} from "@/lib/email/order-email-summary"
import { resolveSmtpFrom, sendSmtpMail } from "@/lib/email/smtp"
import { generateAndStoreOrderInvoice } from "@/lib/invoices/process-order-invoice"
import { formatChf, formatInvoiceDate } from "@/lib/invoices/invoice-format"
import { swissPostTrackingUrl } from "@/lib/konto/customer-order-timeline"
import {
  buildTwintPaymentUrl,
  isTwintPaymentLinkConfigured,
} from "@/lib/twint/payment-link"
import { resolveKontoinhaber } from "@/lib/documents/document-template-types"
import { resolveSiteOrigin } from "@/lib/site/site-origin"

const VORKASSE_CORE_HINT =
  "Vielen Dank für deine Bestellung! Bitte beachte: Da es sich um eine Vorkasse-Zahlung handelt, wird deine Bestellung erst nach vollständigem Erhalt der Zahlung bearbeitet und angefertigt/versendet."

async function markEmailSent(
  orderId: string,
  key: "receivedAt" | "confirmedAt" | "readyAt" | "shippedAt"
): Promise<void> {
  await updateOrderEmailNotifications(orderId, {
    [key]: new Date().toISOString(),
  })
}

function renderOrderDetailsHtml(order: StoredOrder): string {
  const delivery = order.delivery ?? order.billing
  return (
    textToHtmlParagraphs(
      [
        `Bestellnummer: ${order.orderId}`,
        `Datum: ${formatInvoiceDate(order.createdAt)}`,
        `Zahlungsart: ${order.paymentMethodLabel}`,
        `Zahlungsstatus: ${resolvePaymentStatusLabel(order)}`,
        `Versandart: ${resolveShippingLabel(order)}`,
      ].join("\n")
    ) +
    renderOrderItemsTableHtml(
      order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }))
    ) +
    textToHtmlParagraphs(
      [
        formatOrderTotalsBlock(order),
        "",
        formatOrderAddressBlock("Rechnungsadresse:", order.billing),
        "",
        formatOrderAddressBlock("Lieferadresse:", delivery),
      ].join("\n")
    )
  )
}

function isPrepaidOrderAwaitingPayment(order: StoredOrder): boolean {
  if (order.paymentMethod === "invoice") return true
  if (order.paymentMethod === "twint" && !order.paymentConfirmed) return true
  return false
}

function buildTwintPaymentHint(order: StoredOrder): {
  plain: string
  html: string
} | null {
  if (order.paymentMethod !== "twint" || order.paymentConfirmed) return null
  if (!isTwintPaymentLinkConfigured()) return null

  let twintUrl: string
  try {
    twintUrl = buildTwintPaymentUrl({
      orderId: order.orderId,
      amountChf: order.totals.total,
    })
  } catch {
    return null
  }

  const plain = [
    "——— TWINT-Zahlung ———",
    `Betrag: ${formatChf(order.totals.total)}`,
    `Bestell-ID: ${order.orderId}`,
    "",
    `Falls du die Zahlung in der App noch nicht abgeschlossen hast, kannst du dies hier nachholen: ${twintUrl}`,
  ].join("\n")

  const html =
    textToHtmlParagraphs(
      [
        "TWINT-Zahlung",
        `Betrag: ${formatChf(order.totals.total)}`,
        `Bestell-ID: ${order.orderId}`,
        "",
        "Falls du die Zahlung in der App noch nicht abgeschlossen hast, kannst du dies hier nachholen:",
      ].join("\n")
    ) +
    `<p style="margin:16px 0;"><a href="${twintUrl}" style="display:inline-block;padding:12px 20px;background:#000000;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Jetzt mit TWINT bezahlen</a></p>` +
    `<p style="font-size:12px;word-break:break-all;"><a href="${twintUrl}">${twintUrl}</a></p>`

  return { plain, html }
}

function buildInvoiceBankHint(
  order: StoredOrder,
  bank: { iban: string; kontoinhaber: string; bankname: string }
): { plain: string; html: string } | null {
  if (order.paymentMethod !== "invoice") return null

  const amount = formatChf(order.totals.total)
  const lines = [
    "——— Banküberweisung (Vorkasse) ———",
    `Bitte überweise den Gesamtbetrag von ${amount} CHF unter Angabe der Bestell-ID ${order.orderId} als Verwendungszweck.`,
  ]
  if (bank.kontoinhaber) lines.push(`Kontoinhaber: ${bank.kontoinhaber}`)
  if (bank.iban) lines.push(`IBAN: ${bank.iban}`)
  if (bank.bankname) lines.push(`Bank: ${bank.bankname}`)

  const plain = lines.join("\n")
  const html = textToHtmlParagraphs(
    [
      "Banküberweisung (Vorkasse)",
      `Bitte überweise den Gesamtbetrag von ${amount} CHF unter Angabe der Bestell-ID ${order.orderId} als Verwendungszweck.`,
      bank.kontoinhaber ? `Kontoinhaber: ${bank.kontoinhaber}` : "",
      bank.iban ? `IBAN: ${bank.iban}` : "",
      bank.bankname ? `Bank: ${bank.bankname}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  )

  return { plain, html }
}

/** Kunden-Bestellbestätigung bei neuer Bestellung. */
export async function notifyOrderReceived(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<boolean> {
  if (order.emailNotifications?.receivedAt) {
    console.info(
      `E-Mail: Bestelleingang bereits gesendet — überspringe (${order.orderId}).`
    )
    return false
  }

  try {
    let adminSettings = settings
    if (!adminSettings) {
      try {
        adminSettings = await getSettings()
      } catch (settingsError) {
        console.error("SMTP Customer Mail Error:", settingsError)
      }
    }

    let branding: {
      companyName: string
      contactEmail: string
      footerLines: { line1: string; line2: string; line3: string }
      logoUrl: string | null
    }
    try {
      if (adminSettings) {
        branding = await resolveEmailBranding(adminSettings)
      } else {
        throw new Error("AdminSettings fehlen")
      }
    } catch (brandingError) {
      console.error("SMTP Customer Mail Error:", brandingError)
      branding = {
        companyName: "DripForge",
        contactEmail: "shop@dripforge.ch",
        footerLines: {
          line1: "DripForge",
          line2: "shop@dripforge.ch",
          line3: "",
        },
        logoUrl: null,
      }
    }

    // Template nur für Bankhinweis — Fehler dürfen Mail nicht blockieren
    let invoiceHint: { plain: string; html: string } | null = null
    try {
      const template = await getDocumentTemplateSettings()
      invoiceHint = buildInvoiceBankHint(order, {
        iban: template.iban?.trim() || adminSettings?.company.iban?.trim() || "",
        kontoinhaber:
          resolveKontoinhaber(template) ||
          adminSettings?.company.firmenname?.trim() ||
          "",
        bankname:
          template.bankname?.trim() ||
          adminSettings?.company.bankname?.trim() ||
          "",
      })
    } catch (templateError) {
      console.error(
        "SMTP Customer Mail Error:",
        templateError instanceof Error
          ? `Dokumentenvorlage für Bankhinweis fehlgeschlagen (${order.orderId}) — sende ohne Bankdaten.`
          : templateError
      )
    }

    const customerName = `${order.billing.firstName} ${order.billing.lastName}`.trim()
    const prepaid = isPrepaidOrderAwaitingPayment(order)
    const accountUrl = `${resolveSiteOrigin()}/konto/bestellungen`

    const subject = prepaid
      ? `Deine Bestellung ${order.orderId} ist eingegangen (Wartet auf Zahlungseingang)`
      : `Deine Bestellung ${order.orderId} ist in Bearbeitung`

    const twintHint = buildTwintPaymentHint(order)

    const introPlain = prepaid
      ? [
          `Guten Tag ${customerName},`,
          "",
          "vielen Dank für Ihre Bestellung bei DripForge — dies ist die Bestätigung Ihres Bestelleingangs.",
          "",
          VORKASSE_CORE_HINT,
        ]
      : [
          `Guten Tag ${customerName},`,
          "",
          "vielen Dank für Ihre Bestellung bei DripForge — wir haben Ihre Zahlung erhalten und die Bestellung aufgenommen.",
        ]

    const closingPlain = prepaid
      ? "Sobald der Zahlungseingang bei uns verbucht ist, bearbeiten wir Ihre Bestellung und halten Sie per E-Mail auf dem Laufenden."
      : "Wir prüfen Ihre Angaben und halten Sie über den weiteren Verlauf per E-Mail auf dem Laufenden."

    const accountPlain = [
      "",
      `Bestellungen im Kundenkonto ansehen: ${accountUrl}`,
    ].join("\n")

    const plain = [
      ...introPlain,
      "",
      formatOrderSummaryPlain(order),
      "",
      ...(twintHint ? [twintHint.plain, ""] : []),
      ...(invoiceHint ? [invoiceHint.plain, ""] : []),
      closingPlain,
      accountPlain,
      "",
      "Freundliche Grüsse",
      branding.companyName,
    ].join("\n")

    const html = renderDripForgeEmailHtml({
      title: prepaid ? "Bestelleingang" : "Bestellbestätigung",
      bodyHtml:
        textToHtmlParagraphs(introPlain.join("\n")) +
        renderOrderDetailsHtml(order) +
        (twintHint?.html ?? "") +
        (invoiceHint?.html ?? "") +
        textToHtmlParagraphs(closingPlain) +
        renderEmailCtaButton(accountUrl, "Zu meinen Bestellungen"),
      footerLines: branding.footerLines,
      logoUrl: branding.logoUrl ?? undefined,
    })

    // Eingangsmail NIEMALS mit PDF-Anhang — PDF nur in Status-Mails (notifyOrderConfirmed)
    const sent = await sendSmtpMail({
      from: resolveSmtpFrom("DripForge", "shop@dripforge.ch"),
      to: order.billing.email,
      subject,
      text: plain,
      html,
    })

    if (sent) {
      try {
        await markEmailSent(order.orderId, "receivedAt")
      } catch (markError) {
        // Mail ist raus — Markierung ist optional
        console.error("Bestell-Mail Fehler:", markError)
      }
      console.info(`E-Mail: Bestelleingang/Bestätigung gesendet (${order.orderId}).`)
    } else {
      console.error(
        "SMTP Customer Mail Error:",
        new Error(`sendSmtpMail returned false (${order.orderId} → ${order.billing.email})`)
      )
    }

    return sent
  } catch (error) {
    console.error("SMTP Customer Mail Error:", error)
    console.error(
      `E-Mail: Bestelleingang/Bestätigung fehlgeschlagen (${order.orderId}).`,
      error
    )
    return false
  }
}

/** Status «In Bearbeitung» inkl. optionaler Rechnung. */
export async function notifyOrderConfirmed(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<boolean> {
  if (order.emailNotifications?.confirmedAt) return false
  if (order.status === "storniert") return false

  try {
    const adminSettings = settings ?? (await getSettings())
    const branding = await resolveEmailBranding(adminSettings)
    const customerName = `${order.billing.firstName} ${order.billing.lastName}`.trim()
    const subject = `Deine Bestellung ${order.orderId} ist in Bearbeitung`

    let pdfBuffer: Buffer | undefined
    try {
      pdfBuffer = await generateAndStoreOrderInvoice(order, adminSettings)
    } catch (error) {
      // PDF darf den Mailversand NIEMALS blockieren — Mail geht ohne Anhang raus
      console.error("Bestell-Mail Fehler:", error)
      console.error(
        `E-Mail: Rechnung für Bestätigung ${order.orderId} konnte nicht erzeugt werden — sende ohne PDF.`,
        error
      )
      pdfBuffer = undefined
    }

    const plain = [
      `Guten Tag ${customerName},`,
      "",
      `gute Nachrichten — deine Bestellung ${order.orderId} ist jetzt in Bearbeitung.`,
      "",
      formatOrderSummaryPlain(order),
      "",
      pdfBuffer
        ? "Im Anhang findest du die Rechnung als PDF für deine Unterlagen."
        : "Die Rechnung stellen wir dir bei Bedarf separat zur Verfügung.",
      "",
      "Wir halten dich über den weiteren Verlauf auf dem Laufenden.",
      "",
      "Freundliche Grüsse",
      branding.companyName,
    ].join("\n")

    const html = renderDripForgeEmailHtml({
      title: "In Bearbeitung",
      bodyHtml:
        textToHtmlParagraphs(
          [
            `Guten Tag ${customerName},`,
            "",
            `gute Nachrichten — deine Bestellung ${order.orderId} ist jetzt in Bearbeitung.`,
          ].join("\n")
        ) +
        renderOrderDetailsHtml(order) +
        textToHtmlParagraphs(
          pdfBuffer
            ? "Im Anhang findest du die Rechnung als PDF für deine Unterlagen."
            : "Die Rechnung stellen wir dir bei Bedarf separat zur Verfügung."
        ),
      footerLines: branding.footerLines,
      logoUrl: branding.logoUrl ?? undefined,
    })

    const sent = await sendSmtpMail({
      from: resolveSmtpFrom(branding.companyName, branding.contactEmail),
      to: order.billing.email,
      subject,
      text: plain,
      html,
      attachments: pdfBuffer
        ? [
            {
              filename: `Rechnung-${order.orderId}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ]
        : undefined,
    })

    if (sent) {
      await markEmailSent(order.orderId, "confirmedAt")
      console.info(`E-Mail: Status «In Bearbeitung» gesendet (${order.orderId}).`)
    }

    return sent
  } catch (error) {
    console.error(
      `E-Mail: Status «In Bearbeitung» fehlgeschlagen (${order.orderId}).`,
      error
    )
    return false
  }
}

/** Status «Abholbereit» / bereit für Versand. */
export async function notifyOrderReady(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<boolean> {
  if (order.emailNotifications?.readyAt) return false
  if (order.status === "storniert") return false

  try {
    const adminSettings = settings ?? (await getSettings())
    const branding = await resolveEmailBranding(adminSettings)
    const customerName = `${order.billing.firstName} ${order.billing.lastName}`.trim()
    const isPickup = order.shippingMethod === "pickup"
    const title = isPickup ? "Abholbereit" : "Bereit für den Versand"
    const subject = isPickup
      ? `Deine Bestellung ${order.orderId} ist abholbereit`
      : `Deine Bestellung ${order.orderId} ist bereit für den Versand`

    const lead = isPickup
      ? `deine Bestellung ${order.orderId} ist fertig und kann in Pfäffikon ZH abgeholt werden.`
      : `deine Bestellung ${order.orderId} ist fertig und wird demnächst versendet.`

    const plain = [
      `Guten Tag ${customerName},`,
      "",
      `gute Nachrichten — ${lead}`,
      "",
      formatOrderSummaryPlain(order),
      "",
      "Bei Fragen melde dich gerne bei uns.",
      "",
      "Freundliche Grüsse",
      branding.companyName,
    ].join("\n")

    const html = renderDripForgeEmailHtml({
      title,
      bodyHtml:
        textToHtmlParagraphs(
          [`Guten Tag ${customerName},`, "", `gute Nachrichten — ${lead}`].join(
            "\n"
          )
        ) +
        renderOrderDetailsHtml(order) +
        textToHtmlParagraphs("Bei Fragen melde dich gerne bei uns."),
      footerLines: branding.footerLines,
      logoUrl: branding.logoUrl ?? undefined,
    })

    const sent = await sendSmtpMail({
      from: resolveSmtpFrom(branding.companyName, branding.contactEmail),
      to: order.billing.email,
      subject,
      text: plain,
      html,
    })

    if (sent) {
      await markEmailSent(order.orderId, "readyAt")
      console.info(`E-Mail: Status «${title}» gesendet (${order.orderId}).`)
    }

    return sent
  } catch (error) {
    console.error(
      `E-Mail: Status «Abholbereit/Versandbereit» fehlgeschlagen (${order.orderId}).`,
      error
    )
    return false
  }
}

export async function notifyOrderShipped(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<boolean> {
  if (order.emailNotifications?.shippedAt) return false

  try {
    const adminSettings = settings ?? (await getSettings())
    const branding = await resolveEmailBranding(adminSettings)
    const customerName = `${order.billing.firstName} ${order.billing.lastName}`.trim()
    const subject = `Deine Bestellung ${order.orderId} wurde versendet`
    const trackingNumber = order.trackingNumber?.trim()
    const trackingUrl = trackingNumber
      ? swissPostTrackingUrl(trackingNumber)
      : null

    const trackingBlock = trackingNumber
      ? [
          `Sendungsnummer: ${trackingNumber}`,
          trackingUrl ? `Sendung verfolgen: ${trackingUrl}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : ""

    const plain = [
      `Guten Tag ${customerName},`,
      "",
      `gute Nachrichten — deine Bestellung ${order.orderId} ist auf dem Weg zu dir.`,
      "",
      trackingBlock,
      trackingBlock ? "" : null,
      formatOrderSummaryPlain(order),
      "",
      "Bei Fragen melde dich gerne bei uns.",
      "",
      "Freundliche Grüsse",
      branding.companyName,
    ]
      .filter((line) => line !== null)
      .join("\n")

    const html = renderDripForgeEmailHtml({
      title: "Versendet",
      bodyHtml:
        textToHtmlParagraphs(
          [
            `Guten Tag ${customerName},`,
            "",
            `gute Nachrichten — deine Bestellung ${order.orderId} ist auf dem Weg zu dir.`,
            "",
            trackingBlock,
          ]
            .filter(Boolean)
            .join("\n")
        ) +
        renderOrderDetailsHtml(order) +
        textToHtmlParagraphs("Bei Fragen melde dich gerne bei uns."),
      footerLines: branding.footerLines,
      logoUrl: branding.logoUrl ?? undefined,
    })

    const sent = await sendSmtpMail({
      from: resolveSmtpFrom(branding.companyName, branding.contactEmail),
      to: order.billing.email,
      subject,
      text: plain,
      html,
    })

    if (sent) {
      await markEmailSent(order.orderId, "shippedAt")
      console.info(`E-Mail: Versandbenachrichtigung gesendet (${order.orderId}).`)
    }

    return sent
  } catch (error) {
    console.error(
      `E-Mail: Versandbenachrichtigung fehlgeschlagen (${order.orderId}).`,
      error
    )
    return false
  }
}

export function shouldSendOrderConfirmedEmail(
  previous: StoredOrder | null,
  next: StoredOrder
): boolean {
  if (next.emailNotifications?.confirmedAt) return false
  if (next.status === "storniert") return false

  if (next.status === "in_produktion" && previous?.status !== "in_produktion") {
    return true
  }

  if (
    next.productionStatus === "in_produktion" &&
    previous?.productionStatus !== "in_produktion"
  ) {
    return true
  }

  return false
}

export function shouldSendOrderReadyEmail(
  previous: StoredOrder | null,
  next: StoredOrder
): boolean {
  if (next.emailNotifications?.readyAt) return false
  if (next.status === "storniert") return false

  return (
    next.productionStatus === "bereit_fuer_versand" &&
    previous?.productionStatus !== "bereit_fuer_versand"
  )
}

export async function maybeNotifyOrderConfirmed(
  previous: StoredOrder | null,
  next: StoredOrder
): Promise<boolean> {
  if (!shouldSendOrderConfirmedEmail(previous, next)) return false
  const settings = await getSettings()
  return notifyOrderConfirmed(next, settings)
}

export async function maybeNotifyOrderReady(
  previous: StoredOrder | null,
  next: StoredOrder
): Promise<boolean> {
  if (!shouldSendOrderReadyEmail(previous, next)) return false
  const settings = await getSettings()
  return notifyOrderReady(next, settings)
}

/** Statuswechsel → passende Kunden-E-Mail (In Bearbeitung / Abholbereit). */
export async function maybeNotifyOrderStatusChange(
  previous: StoredOrder | null,
  next: StoredOrder
): Promise<boolean> {
  const confirmed = await maybeNotifyOrderConfirmed(previous, next)
  const ready = await maybeNotifyOrderReady(previous, next)
  return confirmed || ready
}

export async function notifyDruckanfrageReceived(options: {
  customerEmail: string
  customerName?: string
  anfrageId: string
  fileName: string
  estimatedTotalPrice: number
}): Promise<boolean> {
  if (!options.customerEmail.trim()) return false

  try {
    const settings = await getSettings()
    const branding = await resolveEmailBranding(settings)
    const customerName = options.customerName?.trim() || "dort"
    const subject = "Deine DripForge Anfrage ist eingegangen"

    const plain = [
      `Guten Tag ${customerName},`,
      "",
      "vielen Dank — wir haben deine 3D-Druckanfrage erfolgreich erhalten.",
      "",
      `Anfrage-Nr.: ${options.anfrageId}`,
      `Datei: ${options.fileName}`,
      `Voraussichtlicher Richtpreis: ab CHF ${options.estimatedTotalPrice.toFixed(2)}`,
      "",
      "Wir prüfen deine Datei und melden uns mit dem exakten Festpreis.",
      "",
      "Freundliche Grüsse",
      branding.companyName,
    ].join("\n")

    const html = renderDripForgeEmailHtml({
      title: "Anfrage eingegangen",
      bodyHtml: textToHtmlParagraphs(plain),
      footerLines: branding.footerLines,
      logoUrl: branding.logoUrl ?? undefined,
    })

    return sendSmtpMail({
      from: resolveSmtpFrom(branding.companyName, branding.contactEmail),
      to: options.customerEmail,
      subject,
      text: plain,
      html,
    })
  } catch (error) {
    console.error(
      `E-Mail: Druckanfrage-Eingangsbestätigung fehlgeschlagen (${options.anfrageId}).`,
      error
    )
    return false
  }
}

export async function notifyKontaktanfrageReceived(
  anfrage: Kontaktanfrage
): Promise<boolean> {
  if (!anfrage.email.trim()) return false

  try {
    const settings = await getSettings()
    const branding = await resolveEmailBranding(settings)
    const subject = "Deine DripForge Nachricht ist eingegangen"

    const plain = [
      `Guten Tag ${anfrage.name},`,
      "",
      "vielen Dank — wir haben deine Nachricht erfolgreich erhalten.",
      "",
      `Anfrage-Nr.: ${anfrage.id}`,
      `Betreff: ${anfrage.subject}`,
      `Anfrage-Typ: ${KONTAKT_INQUIRY_LABELS[anfrage.inquiryType]}`,
      "",
      "Wir prüfen deine Anfrage und melden uns so schnell wie möglich.",
      "",
      "Freundliche Grüsse",
      branding.companyName,
    ].join("\n")

    const html = renderDripForgeEmailHtml({
      title: "Nachricht eingegangen",
      bodyHtml: textToHtmlParagraphs(plain),
      footerLines: branding.footerLines,
      logoUrl: branding.logoUrl ?? undefined,
    })

    return sendSmtpMail({
      from: resolveSmtpFrom(branding.companyName, branding.contactEmail),
      to: anfrage.email,
      subject,
      text: plain,
      html,
    })
  } catch (error) {
    console.error(
      `E-Mail: Kontakt-Eingangsbestätigung fehlgeschlagen (${anfrage.id}).`,
      error
    )
    return false
  }
}

export async function refreshOrderAndNotifyConfirmed(
  orderId: string
): Promise<boolean> {
  const order = await getOrderById(orderId)
  if (!order) return false
  return notifyOrderConfirmed(order)
}
