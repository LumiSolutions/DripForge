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
  renderOrderConfirmationEmailHtml,
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
import {
  buildOrderEmailPlaceholders,
  resolveOrderEmailFooter,
  resolveOrderEmailIntro,
} from "@/lib/email/order-email-templates"
import {
  normalizeOrderEmailLayout,
  type OrderEmailMetaFields,
} from "@/lib/email/order-email-layout"
import { isHandoffFulfillment } from "@/lib/admin/order-fulfillment"
import { generateAndStoreOrderInvoice } from "@/lib/invoices/process-order-invoice"
import { ensureOrderInvoiceNumber } from "@/lib/invoices/order-invoice-number"
import {
  resolveOrderBestellRef,
  resolveOrderInvoiceNumber,
} from "@/lib/invoices/order-invoice-display"
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

async function withInvoiceNumber(order: StoredOrder): Promise<StoredOrder> {
  try {
    const invoiceNumber = await ensureOrderInvoiceNumber(order)
    return { ...order, invoiceNumber }
  } catch (error) {
    console.warn(
      `Rechnungsnummer für Mail ${order.orderId} konnte nicht vergeben werden.`,
      error
    )
    return order
  }
}

function orderDisplayRef(order: StoredOrder): string {
  return resolveOrderInvoiceNumber(order)
}

async function markEmailSent(
  orderId: string,
  key: "receivedAt" | "confirmedAt" | "readyAt" | "shippedAt"
): Promise<void> {
  await updateOrderEmailNotifications(orderId, {
    [key]: new Date().toISOString(),
  })
}

function renderOrderMetaHtml(
  order: StoredOrder,
  metaFields?: OrderEmailMetaFields
): string {
  const fields = metaFields ?? normalizeOrderEmailLayout(undefined).metaFields!
  const invoiceNumber = resolveOrderInvoiceNumber(order)
  const bestellRef = resolveOrderBestellRef(order)
  const hasInvoiceNumber =
    Boolean(order.invoiceNumber?.trim()) || invoiceNumber !== order.orderId
  const lines: Array<string | null> = []

  if (fields.invoiceNumber) {
    lines.push(
      hasInvoiceNumber
        ? `Rechnungsnummer: ${invoiceNumber}`
        : `Bestellnummer: ${order.orderId}`
    )
  }
  if (fields.orderRef && bestellRef && hasInvoiceNumber) {
    lines.push(`Bestell-Ref: ${bestellRef}`)
  }
  if (fields.date) {
    lines.push(`Datum: ${formatInvoiceDate(order.createdAt)}`)
  }
  if (fields.paymentMethod) {
    lines.push(`Zahlungsart: ${order.paymentMethodLabel}`)
  }
  if (fields.paymentStatus) {
    lines.push(`Zahlungsstatus: ${resolvePaymentStatusLabel(order)}`)
  }
  if (fields.shippingMethod) {
    lines.push(`Versandart: ${resolveShippingLabel(order)}`)
  }

  if (lines.length === 0) return ""
  return textToHtmlParagraphs(lines.filter((line) => line != null).join("\n"))
}

function renderOrderItemsSectionHtml(
  order: StoredOrder,
  metaFields?: OrderEmailMetaFields
): string {
  return (
    renderOrderMetaHtml(order, metaFields) +
    renderOrderItemsTableHtml(
      order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }))
    )
  )
}

function renderOrderTotalsSectionHtml(order: StoredOrder): string {
  return textToHtmlParagraphs(formatOrderTotalsBlock(order))
}

function renderOrderAddressSectionHtml(order: StoredOrder): string {
  const delivery = order.delivery ?? order.billing
  return textToHtmlParagraphs(
    [
      formatOrderAddressBlock("Rechnungsadresse:", order.billing),
      "",
      formatOrderAddressBlock("Lieferadresse:", delivery),
    ].join("\n")
  )
}

function renderOrderDetailsHtml(order: StoredOrder): string {
  return (
    renderOrderItemsSectionHtml(order) +
    renderOrderTotalsSectionHtml(order) +
    renderOrderAddressSectionHtml(order)
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
    `Rechnungsnummer: ${orderDisplayRef(order)}`,
    resolveOrderBestellRef(order)
      ? `Bestell-Ref: ${resolveOrderBestellRef(order)}`
      : null,
    "",
    `Falls du die Zahlung in der App noch nicht abgeschlossen hast, kannst du dies hier nachholen: ${twintUrl}`,
  ]
    .filter((line) => line != null)
    .join("\n")

  const html =
    textToHtmlParagraphs(
      [
        "TWINT-Zahlung",
        `Betrag: ${formatChf(order.totals.total)}`,
        `Rechnungsnummer: ${orderDisplayRef(order)}`,
        resolveOrderBestellRef(order)
          ? `Bestell-Ref: ${resolveOrderBestellRef(order)}`
          : "",
        "",
        "Falls du die Zahlung in der App noch nicht abgeschlossen hast, kannst du dies hier nachholen:",
      ]
        .filter(Boolean)
        .join("\n")
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

  const invoiceRef = orderDisplayRef(order)
  const amount = formatChf(order.totals.total)
  const lines = [
    "——— Banküberweisung (Vorkasse) ———",
    `Bitte überweise den Gesamtbetrag von ${amount} CHF unter Angabe der Rechnungsnummer ${invoiceRef} als Verwendungszweck.`,
  ]
  if (bank.kontoinhaber) lines.push(`Kontoinhaber: ${bank.kontoinhaber}`)
  if (bank.iban) lines.push(`IBAN: ${bank.iban}`)
  if (bank.bankname) lines.push(`Bank: ${bank.bankname}`)

  const plain = lines.join("\n")
  const html = textToHtmlParagraphs(
    [
      "Banküberweisung (Vorkasse)",
      `Bitte überweise den Gesamtbetrag von ${amount} CHF unter Angabe der Rechnungsnummer ${invoiceRef} als Verwendungszweck.`,
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
    let workingOrder = await withInvoiceNumber(order)
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
      invoiceHint = buildInvoiceBankHint(workingOrder, {
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

    const prepaid = isPrepaidOrderAwaitingPayment(workingOrder)
    const accountUrl = `${resolveSiteOrigin()}/konto/bestellungen`
    const placeholders = buildOrderEmailPlaceholders(workingOrder)
    const displayRef = orderDisplayRef(workingOrder)

    const subject = prepaid
      ? `Deine Bestellung ${displayRef} ist eingegangen (Wartet auf Zahlungseingang)`
      : `Deine Bestellung ${displayRef} ist in Bearbeitung`

    const twintHint = buildTwintPaymentHint(workingOrder)

    const introText = resolveOrderEmailIntro(adminSettings, placeholders, {
      prepaid,
      vorkasseHint: prepaid ? VORKASSE_CORE_HINT : undefined,
    })
    const closingPlain = resolveOrderEmailFooter(adminSettings, placeholders, {
      prepaid,
      prepaidFallback:
        "Sobald der Zahlungseingang bei uns verbucht ist, bearbeiten wir Ihre Bestellung und halten Sie per E-Mail auf dem Laufenden.",
    })

    const accountPlain = [
      "",
      `Bestellungen im Kundenkonto ansehen: ${accountUrl}`,
    ].join("\n")

    // PDF optional — Fehler dürfen den Mailversand nicht blockieren
    let pdfBuffer: Buffer | undefined
    try {
      pdfBuffer = await generateAndStoreOrderInvoice(
        workingOrder,
        adminSettings
      )
      workingOrder = await withInvoiceNumber(workingOrder)
    } catch (pdfError) {
      console.error("Bestell-Mail Fehler:", pdfError)
      console.error(
        `E-Mail: PDF-Rechnung für ${order.orderId} fehlgeschlagen — sende ohne Anhang.`
      )
      pdfBuffer = undefined
    }

    const pdfPlainHint = pdfBuffer
      ? "Im Anhang findest du die Rechnung als PDF."
      : ""

    const plain = [
      introText,
      "",
      formatOrderSummaryPlain(workingOrder),
      "",
      ...(twintHint ? [twintHint.plain, ""] : []),
      ...(invoiceHint ? [invoiceHint.plain, ""] : []),
      ...(pdfPlainHint ? [pdfPlainHint, ""] : []),
      closingPlain,
      accountPlain,
      "",
      "Freundliche Grüsse",
      branding.companyName,
    ].join("\n")

    const emailLayout = normalizeOrderEmailLayout(adminSettings?.orderEmailLayout)

    const html = renderOrderConfirmationEmailHtml({
      layout: emailLayout,
      title: prepaid ? "Bestelleingang" : "Bestellbestätigung",
      sections: {
        header: "",
        intro: textToHtmlParagraphs(introText),
        orderItems: renderOrderItemsSectionHtml(
          workingOrder,
          emailLayout.metaFields
        ),
        totals: renderOrderTotalsSectionHtml(workingOrder),
        addressBlock: renderOrderAddressSectionHtml(workingOrder),
        footer: textToHtmlParagraphs(closingPlain),
      },
      extraHtml:
        (twintHint?.html ?? "") +
        (invoiceHint?.html ?? "") +
        (pdfPlainHint ? textToHtmlParagraphs(pdfPlainHint) : "") +
        renderEmailCtaButton(accountUrl, "Zu meinen Bestellungen"),
      footerLines: branding.footerLines,
      logoUrl: branding.logoUrl ?? undefined,
    })

    const sent = await sendSmtpMail({
      from: resolveSmtpFrom("DripForge", "shop@dripforge.ch"),
      to: order.billing.email,
      subject,
      text: plain,
      html,
      attachments: pdfBuffer
        ? [
            {
              filename: `Rechnung-${orderDisplayRef(workingOrder)}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ]
        : undefined,
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
    const workingOrder = await withInvoiceNumber(order)
    const adminSettings = settings ?? (await getSettings())
    const branding = await resolveEmailBranding(adminSettings)
    const customerName = `${workingOrder.billing.firstName} ${workingOrder.billing.lastName}`.trim()
    const displayRef = orderDisplayRef(workingOrder)
    const subject = `Deine Bestellung ${displayRef} ist in Bearbeitung`

    let pdfBuffer: Buffer | undefined
    try {
      pdfBuffer = await generateAndStoreOrderInvoice(workingOrder, adminSettings)
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
      `gute Nachrichten — deine Bestellung ${displayRef} ist jetzt in Bearbeitung.`,
      "",
      formatOrderSummaryPlain(workingOrder),
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
            `gute Nachrichten — deine Bestellung ${displayRef} ist jetzt in Bearbeitung.`,
          ].join("\n")
        ) +
        renderOrderDetailsHtml(workingOrder) +
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
              filename: `Rechnung-${displayRef}.pdf`,
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
    const handoff = isHandoffFulfillment(order)
    const subject = handoff
      ? `Deine Bestellung ${order.orderId} wurde abgeholt / übergeben`
      : `Deine Bestellung ${order.orderId} wurde versendet`
    const trackingNumber = handoff ? "" : order.trackingNumber?.trim()
    const trackingUrl = trackingNumber
      ? swissPostTrackingUrl(trackingNumber)
      : null
    const title = handoff ? "Abholung / Übergabe abgeschlossen" : "Versendet"
    const lead = handoff
      ? `gute Nachrichten — deine Bestellung ${order.orderId} wurde abgeholt oder direkt übergeben.`
      : `gute Nachrichten — deine Bestellung ${order.orderId} ist auf dem Weg zu dir.`

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
      lead,
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
      title,
      bodyHtml:
        textToHtmlParagraphs(
          [
            `Guten Tag ${customerName},`,
            "",
            lead,
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
