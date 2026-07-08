import {
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
  renderOrderItemsTableHtml,
  textToHtmlParagraphs,
} from "@/lib/email/dripforge-email-layout"
import { resolveEmailBranding } from "@/lib/email/order-email-context"
import { resolveSmtpFrom, sendSmtpMail } from "@/lib/email/smtp"
import { generateAndStoreOrderInvoice } from "@/lib/invoices/process-order-invoice"
import { formatChf, formatInvoiceDate } from "@/lib/invoices/invoice-format"
import { swissPostTrackingUrl } from "@/lib/konto/customer-order-timeline"

async function markEmailSent(
  orderId: string,
  key: "receivedAt" | "confirmedAt" | "shippedAt"
): Promise<void> {
  await updateOrderEmailNotifications(orderId, {
    [key]: new Date().toISOString(),
  })
}

export async function notifyOrderReceived(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<boolean> {
  if (order.emailNotifications?.receivedAt) return false

  try {
    const adminSettings = settings ?? (await getSettings())
    const branding = await resolveEmailBranding(adminSettings)
    const customerName = `${order.billing.firstName} ${order.billing.lastName}`.trim()
    const subject = "Deine DripForge Bestellung/Anfrage ist eingegangen"

    const plain = [
      `Guten Tag ${customerName},`,
      "",
      "vielen Dank — wir haben deine Bestellung bzw. Anfrage erfolgreich erhalten.",
      "",
      `Bestellnummer: ${order.orderId}`,
      `Datum: ${formatInvoiceDate(order.createdAt)}`,
      "",
      "Wir prüfen deine Angaben und melden uns mit dem nächsten Schritt oder dem exakten Festpreis.",
      "",
      "Freundliche Grüsse",
      branding.companyName,
    ].join("\n")

    const bodyHtml =
      textToHtmlParagraphs(plain) +
      renderOrderItemsTableHtml(
        order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        }))
      )

    const html = renderDripForgeEmailHtml({
      title: "Bestellung eingegangen",
      bodyHtml,
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
      await markEmailSent(order.orderId, "receivedAt")
      console.info(`E-Mail: Eingangsbestätigung gesendet (${order.orderId}).`)
    }

    return sent
  } catch (error) {
    console.error(`E-Mail: Eingangsbestätigung fehlgeschlagen (${order.orderId}).`, error)
    return false
  }
}

export async function notifyOrderConfirmed(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<boolean> {
  if (order.emailNotifications?.confirmedAt) return false
  if (order.status === "storniert") return false

  const adminSettings = settings ?? (await getSettings())
  const branding = await resolveEmailBranding(adminSettings)
  const customerName = `${order.billing.firstName} ${order.billing.lastName}`.trim()
  const subject = `Auftragsbestätigung & Rechnung zu Deiner Bestellung ${order.orderId}`

  let pdfBuffer: Buffer | undefined
  try {
    pdfBuffer = await generateAndStoreOrderInvoice(order, adminSettings)
  } catch (error) {
    console.error(
      `E-Mail: Rechnung für Bestätigung ${order.orderId} konnte nicht erzeugt werden.`,
      error
    )
  }

  const plain = [
    `Guten Tag ${customerName},`,
    "",
    `deine Bestellung ${order.orderId} wurde geprüft und offiziell bestätigt.`,
    "",
    `Gesamtbetrag: ${formatChf(order.totals.total)}`,
    `Zahlungsart: ${order.paymentMethodLabel}`,
    "",
    pdfBuffer
      ? "Im Anhang findest du die Rechnung als PDF für deine Unterlagen."
      : "Die Rechnung stellen wir dir separat zur Verfügung.",
    "",
    "Wir starten nun mit der Produktion und halten dich auf dem Laufenden.",
    "",
    "Freundliche Grüsse",
    branding.companyName,
  ].join("\n")

  const bodyHtml =
    textToHtmlParagraphs(plain) +
    renderOrderItemsTableHtml(
      order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }))
    )

  const html = renderDripForgeEmailHtml({
    title: "Auftragsbestätigung",
    bodyHtml,
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
    console.info(`E-Mail: Auftragsbestätigung gesendet (${order.orderId}).`)
  }

  return sent
}

export async function notifyOrderShipped(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<boolean> {
  if (order.emailNotifications?.shippedAt) return false

  const adminSettings = settings ?? (await getSettings())
  const branding = await resolveEmailBranding(adminSettings)
  const customerName = `${order.billing.firstName} ${order.billing.lastName}`.trim()
  const subject = "Deine Lieferung von DripForge ist auf dem Weg!"
  const trackingNumber = order.trackingNumber?.trim()
  const trackingUrl = trackingNumber ? swissPostTrackingUrl(trackingNumber) : null

  const plainParts = [
    `Guten Tag ${customerName},`,
    "",
    `gute Nachrichten — deine Bestellung ${order.orderId} ist auf dem Weg zu dir.`,
    "",
  ]

  if (trackingNumber) {
    plainParts.push(`Sendungsnummer: ${trackingNumber}`)
    if (trackingUrl) plainParts.push(`Sendung verfolgen: ${trackingUrl}`)
    plainParts.push("")
  }

  plainParts.push(
    "Enthaltene Artikel:",
    ...order.items.map(
      (item) => `- ${item.quantity}x ${item.name} (${formatChf(item.price * item.quantity)})`
    ),
    "",
    "Bei Fragen melde dich gerne bei uns.",
    "",
    "Freundliche Grüsse",
    branding.companyName
  )

  const plain = plainParts.join("\n")

  let bodyHtml = textToHtmlParagraphs(
    [
      `Guten Tag ${customerName},`,
      "",
      `gute Nachrichten — deine Bestellung ${order.orderId} ist auf dem Weg zu dir.`,
      "",
      trackingNumber
        ? `Sendungsnummer: ${trackingNumber}${trackingUrl ? `\nSendung verfolgen: ${trackingUrl}` : ""}`
        : "",
      "",
      "Enthaltene Artikel:",
    ].join("\n")
  )

  bodyHtml += renderOrderItemsTableHtml(
    order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }))
  )

  bodyHtml += textToHtmlParagraphs("Bei Fragen melde dich gerne bei uns.")

  const html = renderDripForgeEmailHtml({
    title: "Lieferung unterwegs",
    bodyHtml,
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

export async function maybeNotifyOrderConfirmed(
  previous: StoredOrder | null,
  next: StoredOrder
): Promise<boolean> {
  if (!shouldSendOrderConfirmedEmail(previous, next)) return false
  const settings = await getSettings()
  return notifyOrderConfirmed(next, settings)
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
    const subject = "Deine DripForge Bestellung/Anfrage ist eingegangen"

    const plain = [
      `Guten Tag ${customerName},`,
      "",
      "vielen Dank — wir haben deine 3D-Druckanfrage erfolgreich erhalten.",
      "",
      `Anfrage-Nr.: ${options.anfrageId}`,
      `Datei: ${options.fileName}`,
      `Voraussichtlicher Richtpreis: ab CHF ${options.estimatedTotalPrice.toFixed(2)}`,
      "",
      "Wir prüfen deine Datei in unserem Slicing-System (Bambulab) und melden uns mit dem exakten Festpreis.",
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
    const subject = "Deine DripForge Bestellung/Anfrage ist eingegangen"

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

export async function refreshOrderAndNotifyConfirmed(orderId: string): Promise<boolean> {
  const order = await getOrderById(orderId)
  if (!order) return false
  return notifyOrderConfirmed(order)
}
