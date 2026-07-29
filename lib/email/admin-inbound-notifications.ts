import type { Druckanfrage } from "@/lib/admin/druckanfrage-types"
import {
  KONTAKT_INQUIRY_LABELS,
  type Kontaktanfrage,
} from "@/lib/admin/kontaktanfrage-types"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { customerDisplayName } from "@/lib/admin/customers"
import { getSettings } from "@/lib/admin/db"
import type { AdminSettings, StoredOrder, StoredOrderItem } from "@/lib/admin/types"
import { collectOrderFileDownloadLines } from "@/lib/admin/item-downloads"
import {
  renderDripForgeEmailHtml,
  renderEmailCtaButton,
  textToHtmlParagraphs,
} from "@/lib/email/dripforge-email-layout"
import { resolveEmailBranding } from "@/lib/email/order-email-context"
import {
  formatOrderAddressBlock,
  resolvePaymentStatusLabel,
} from "@/lib/email/order-email-summary"
import { resolveAdminNotifyEmail } from "@/lib/email/resolve-admin-notify-email"
import { resolveSmtpFrom, sendSmtpMail } from "@/lib/email/smtp"
import { formatChf, formatInvoiceDate } from "@/lib/invoices/invoice-format"
import {
  ensureOrderInvoiceNumber,
  resolveOrderBestellRef,
  resolveOrderInvoiceNumber,
} from "@/lib/invoices/order-invoice-number"
import { resolveSiteOrigin } from "@/lib/site/site-origin"

function buildAdminPortalUrl(query: Record<string, string>): string {
  const params = new URLSearchParams(query)
  return `${resolveSiteOrigin()}${adminPortalPath()}?${params.toString()}`
}

export function buildAdminOrderDetailUrl(orderId: string): string {
  return buildAdminPortalUrl({ tab: "orders", order: orderId })
}

export function buildAdminDruckanfrageDetailUrl(anfrageId: string): string {
  return buildAdminPortalUrl({ tab: "print-calculator", anfrage: anfrageId })
}

export function buildAdminKontaktDetailUrl(anfrageId: string): string {
  return buildAdminPortalUrl({ tab: "customers", kontakt: anfrageId })
}

function formatItemOptionLines(item: StoredOrderItem): string[] {
  const d = item.customDetails
  if (!d) return []

  const lines: string[] = []
  const material = d.filament || d.material
  if (material) lines.push(`Material: ${material}`)
  if (d.materialVariant || d.variant) {
    lines.push(`Variante: ${d.materialVariant ?? d.variant}`)
  }
  if (d.color) lines.push(`Farbe: ${d.color}`)
  if (d.colorWishes) lines.push(`Farbwünsche: ${d.colorWishes}`)
  if (d.dimensions) lines.push(`Masse: ${d.dimensions}`)
  if (d.scale) lines.push(`Skalierung: ${d.scale}`)
  if (d.fileName) lines.push(`Datei: ${d.fileName}`)
  if (d.size) lines.push(`Grösse: ${d.size}`)
  if (d.engravingText || d.userText) {
    lines.push(`Text: ${d.engravingText ?? d.userText}`)
  }
  if (d.hasEmbeddedModelColors) lines.push("Modell mit eingebetteten Farben")
  if (d.isCustomerInbound || d.customerShipping) {
    lines.push("Kunde sendet eigenes Produkt ein")
  }
  return lines
}

function formatOrderOptionsSummary(order: StoredOrder): string {
  const blocks = order.items.map((item) => {
    const optionLines = formatItemOptionLines(item)
    const header = `${item.quantity}x ${item.name} (${formatChf(item.price * item.quantity)})`
    if (optionLines.length === 0) return header
    return [header, ...optionLines.map((line) => `  · ${line}`)].join("\n")
  })

  const meta = [
    `Zahlungsart: ${order.paymentMethodLabel}`,
    `Versand: ${order.shippingMethod}`,
    `Gesamtbetrag: ${formatChf(order.totals.total)}`,
  ]

  return [...blocks, "", ...meta].join("\n")
}

function formatOrderContactBlock(order: StoredOrder): string {
  const name = customerDisplayName(order.billing)
  const lines = [
    `Name: ${name}`,
    `Kontaktkanal: E-Mail`,
    `E-Mail: ${order.billing.email}`,
  ]
  if (order.billing.phone?.trim()) {
    lines.push(`Telefon: ${order.billing.phone.trim()}`)
  }
  return lines.join("\n")
}

function formatDruckanfrageContactBlock(anfrage: Druckanfrage): string {
  const channel =
    anfrage.contactMethod === "whatsapp" ? "WhatsApp" : "E-Mail"
  const lines = [`Kontaktkanal: ${channel}`]

  if (anfrage.customerEmail.trim()) {
    lines.push(`E-Mail: ${anfrage.customerEmail}`)
  }
  if (anfrage.customerPhone?.trim()) {
    lines.push(`Telefon / WhatsApp: ${anfrage.customerPhone.trim()}`)
  }

  return lines.join("\n")
}

function formatDruckanfrageOptionsSummary(anfrage: Druckanfrage): string {
  const dims = `${anfrage.dimensionsMm.x.toFixed(1)} × ${anfrage.dimensionsMm.y.toFixed(1)} × ${anfrage.dimensionsMm.z.toFixed(1)} mm`
  const colors = anfrage.filamentColors.join(", ") || "—"

  return [
    `Datei: ${anfrage.fileName}`,
    `Material: ${anfrage.filamentMaterial}`,
    `Farben: ${colors}`,
    anfrage.colorWishes ? `Farbwünsche: ${anfrage.colorWishes}` : null,
    `Masse: ${dims}`,
    `Skalierung: ${anfrage.scalePercent}%`,
    `Menge: ${anfrage.quantity}`,
    `Volumen: ${anfrage.volumeCm3.toFixed(1)} cm³`,
    `Richtpreis: ab CHF ${anfrage.estimatedTotalPrice.toFixed(2)}`,
    anfrage.hasEmbeddedModelColors ? "Modell mit eingebetteten Farben" : null,
  ]
    .filter(Boolean)
    .join("\n")
}

async function sendAdminInboundEmail(options: {
  referenceId: string
  title: string
  subject: string
  plainBody: string
  dashboardUrl: string
  settings?: AdminSettings
  /** Explizite Zieladresse (sonst ADMIN_NOTIFY_EMAIL / Fallback). */
  to?: string
  /** Zusätzlicher HTML-Block (z. B. Download-Links). */
  extraHtml?: string
}): Promise<boolean> {
  try {
    const adminSettings = options.settings ?? (await getSettings())
    const to =
      options.to?.trim() ||
      resolveAdminNotifyEmail(adminSettings) ||
      "shop@dripforge.ch"

    let branding
    try {
      branding = await resolveEmailBranding(adminSettings)
    } catch (brandingError) {
      console.error("SMTP Admin Mail Error:", brandingError)
      branding = {
        companyName: "DripForge",
        contactEmail: "shop@dripforge.ch",
        footerLines: {
          line1: "DripForge",
          line2: "shop@dripforge.ch",
          line3: "",
        },
        logoUrl: null as string | null,
      }
    }

    const plain = [
      options.plainBody,
      "",
      `Im Admin-Dashboard öffnen: ${options.dashboardUrl}`,
    ].join("\n")

    const bodyHtml =
      textToHtmlParagraphs(options.plainBody) +
      (options.extraHtml ?? "") +
      renderEmailCtaButton(options.dashboardUrl, "Im Admin-Dashboard öffnen")

    const html = renderDripForgeEmailHtml({
      title: options.title,
      bodyHtml,
      footerLines: branding.footerLines,
      logoUrl: branding.logoUrl ?? undefined,
    })

    const sent = await sendSmtpMail({
      from: resolveSmtpFrom("DripForge", "shop@dripforge.ch"),
      to,
      subject: options.subject,
      text: plain,
      html,
    })

    if (sent) {
      console.info(
        `E-Mail: Admin-Benachrichtigung gesendet (${options.referenceId} → ${to}).`
      )
    } else {
      console.error(
        "SMTP Admin Mail Error:",
        new Error(
          `sendSmtpMail returned false (${options.referenceId} → ${to})`
        )
      )
    }

    return sent
  } catch (error) {
    console.error("SMTP Admin Mail Error:", error)
    console.error(
      `E-Mail: Admin-Benachrichtigung fehlgeschlagen (${options.referenceId}).`,
      error
    )
    return false
  }
}

export async function notifyAdminNewOrder(
  order: StoredOrder,
  settings?: AdminSettings,
  options?: { to?: string }
): Promise<boolean> {
  let workingOrder = order
  try {
    const invoiceNumber = await ensureOrderInvoiceNumber(order)
    workingOrder = { ...order, invoiceNumber }
  } catch (error) {
    console.warn(
      `Admin-Mail: Rechnungsnummer für ${order.orderId} konnte nicht vergeben werden.`,
      error
    )
  }

  const dashboardUrl = buildAdminOrderDetailUrl(workingOrder.orderId)
  const delivery = workingOrder.delivery ?? workingOrder.billing
  const invoiceNumber = resolveOrderInvoiceNumber(workingOrder)
  const bestellRef = resolveOrderBestellRef(workingOrder)
  const itemLines = workingOrder.items.map(
    (item) =>
      `- ${item.quantity}x ${item.name} (${formatChf(item.price * item.quantity)})`
  )

  const fileDownloads = collectOrderFileDownloadLines(workingOrder)

  const plainBody = [
    "Neue Bestellung eingegangen.",
    "",
    `Rechnungsnummer: ${invoiceNumber}`,
    bestellRef ? `Bestell-Ref: ${bestellRef}` : null,
    `Kunde: ${customerDisplayName(workingOrder.billing)}`,
    `E-Mail: ${workingOrder.billing.email}`,
    workingOrder.billing.phone?.trim()
      ? `Telefon: ${workingOrder.billing.phone.trim()}`
      : null,
    `Zahlungsart: ${workingOrder.paymentMethodLabel}`,
    `Zahlungsstatus: ${resolvePaymentStatusLabel(workingOrder)}`,
    `Gesamtbetrag: ${formatChf(workingOrder.totals.total)}`,
    `Eingegangen: ${formatInvoiceDate(workingOrder.createdAt)}`,
    "",
    "Artikel:",
    ...itemLines,
    "",
    formatOrderOptionsSummary(workingOrder),
    "",
    ...(fileDownloads.plainLines.length > 0
      ? [...fileDownloads.plainLines, ""]
      : []),
    formatOrderAddressBlock("Lieferadresse:", delivery),
  ]
    .filter((line) => line !== null)
    .join("\n")

  return sendAdminInboundEmail({
    referenceId: workingOrder.orderId,
    title: "Neue Bestellung",
    subject: `🚨 Neue Anfrage/Bestellung eingegangen! #${invoiceNumber}`,
    plainBody,
    dashboardUrl,
    settings,
    to: options?.to,
    extraHtml: fileDownloads.htmlBlock || undefined,
  })
}

export async function notifyAdminNewDruckanfrage(
  anfrage: Druckanfrage,
  settings?: AdminSettings
): Promise<boolean> {
  const dashboardUrl = buildAdminDruckanfrageDetailUrl(anfrage.id)
  const plainBody = [
    "Es ist eine neue 3D-Druckanfrage eingegangen.",
    "",
    formatDruckanfrageContactBlock(anfrage),
    "",
    `Anfrage-Nr.: ${anfrage.id}`,
    `Eingegangen: ${formatInvoiceDate(anfrage.createdAt)}`,
    "",
    "Zusammenfassung:",
    formatDruckanfrageOptionsSummary(anfrage),
  ].join("\n")

  return sendAdminInboundEmail({
    referenceId: anfrage.id,
    title: "Neue Druckanfrage",
    subject: `🚨 Neue Anfrage/Bestellung eingegangen! #${anfrage.id}`,
    plainBody,
    dashboardUrl,
    settings,
  })
}

export async function notifyAdminNewKontaktanfrage(
  anfrage: Kontaktanfrage,
  settings?: AdminSettings
): Promise<boolean> {
  const dashboardUrl = buildAdminKontaktDetailUrl(anfrage.id)
  const plainBody = [
    "Es ist eine neue Kontaktanfrage eingegangen.",
    "",
    `Name: ${anfrage.name}`,
    `E-Mail: ${anfrage.email}`,
    anfrage.company ? `Firma: ${anfrage.company}` : null,
    `Anfrage-Typ: ${KONTAKT_INQUIRY_LABELS[anfrage.inquiryType]}`,
    "",
    `Anfrage-Nr.: ${anfrage.id}`,
    `Betreff: ${anfrage.subject}`,
    `Eingegangen: ${formatInvoiceDate(anfrage.createdAt)}`,
    "",
    "Nachricht:",
    anfrage.message,
  ]
    .filter(Boolean)
    .join("\n")

  return sendAdminInboundEmail({
    referenceId: anfrage.id,
    title: "Neue Kontaktanfrage",
    subject: `🚨 Neue Anfrage/Bestellung eingegangen! #${anfrage.id}`,
    plainBody,
    dashboardUrl,
    settings,
  })
}
