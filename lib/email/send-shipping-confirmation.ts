import nodemailer from "nodemailer"
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { swissPostTrackingUrl } from "@/lib/konto/customer-order-timeline"

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  )
}

function buildTransporter() {
  const port = Number(process.env.SMTP_PORT ?? 587)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

function buildShippingPlainBody(
  order: StoredOrder,
  companyName: string,
  trackingUrl: string
): string {
  return [
    `Guten Tag ${order.billing.firstName} ${order.billing.lastName},`,
    "",
    `Ihre Bestellung ${order.orderId} bei ${companyName} ist unterwegs.`,
    "",
    `Sendungsnummer: ${order.trackingNumber ?? "—"}`,
    `Sendung verfolgen: ${trackingUrl}`,
    "",
    "Bei Fragen melden Sie sich gerne bei uns.",
    "",
    "Freundliche Grüsse",
    companyName,
  ].join("\n")
}

/** Versandbestätigung inkl. Swiss-Post-Tracking-Link (optional, wenn SMTP konfiguriert). */
export async function sendShippingConfirmationEmail(
  order: StoredOrder,
  settings: AdminSettings
): Promise<boolean> {
  if (!order.trackingNumber?.trim()) {
    console.warn(
      "E-Mail: Versandbestätigung übersprungen — keine Tracking-Nummer.",
      order.orderId
    )
    return false
  }

  if (!isSmtpConfigured()) {
    console.info(
      "E-Mail: SMTP nicht konfiguriert — Versandbestätigung vorbereitet, aber nicht gesendet.",
      { orderId: order.orderId, to: order.billing.email }
    )
    return false
  }

  const trackingUrl = swissPostTrackingUrl(order.trackingNumber)
  const from =
    process.env.SMTP_FROM ??
    `"${settings.company.firmenname}" <${settings.company.kontaktEmail}>`

  try {
    const transporter = buildTransporter()
    await transporter.sendMail({
      from,
      to: order.billing.email,
      subject: `${settings.company.firmenname} — Ihre Sendung ist unterwegs (${order.orderId})`,
      text: buildShippingPlainBody(order, settings.company.firmenname, trackingUrl),
    })
    console.info(
      `E-Mail: Versandbestätigung gesendet (${order.orderId} → ${order.billing.email}).`
    )
    return true
  } catch (error) {
    console.error(
      `E-Mail: Versandbestätigung konnte nicht gesendet werden (${order.orderId}).`,
      error
    )
    return false
  }
}
