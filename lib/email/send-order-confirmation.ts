import nodemailer from "nodemailer"
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { formatChf, formatInvoiceDate } from "@/lib/invoices/invoice-format"

type SendOrderEmailOptions = {
  attachInvoice: boolean
  pdfBuffer?: Buffer
}

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

function buildPlainBody(
  order: StoredOrder,
  companyName: string,
  withInvoice: boolean
): string {
  const lines = [
    `Guten Tag ${order.billing.firstName} ${order.billing.lastName},`,
    "",
    `vielen Dank fuer Ihre Bestellung bei ${companyName}.`,
    "",
    `Bestellnummer: ${order.orderId}`,
    `Datum: ${formatInvoiceDate(order.createdAt)}`,
    `Gesamtbetrag: ${formatChf(order.totals.total)}`,
    `Zahlungsart: ${order.paymentMethodLabel}`,
    "",
  ]

  if (withInvoice) {
    lines.push(
      "Im Anhang finden Sie Ihre Rechnung als PDF.",
      "Bitte ueberweisen Sie den Betrag innerhalb von 30 Tagen gemaess den Angaben auf der Rechnung.",
      ""
    )
  } else {
    lines.push(
      "Ihre Bestellung wird bearbeitet. Bei Fragen melden Sie sich gerne bei uns.",
      ""
    )
  }

  lines.push("Freundliche Gruesse", companyName)

  return lines.join("\n")
}

export async function sendOrderConfirmationEmail(
  order: StoredOrder,
  settings: AdminSettings,
  options: SendOrderEmailOptions
): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.error(
      "E-Mail: SMTP nicht konfiguriert (SMTP_HOST, SMTP_USER, SMTP_PASS) — Versand übersprungen.",
      { orderId: order.orderId, to: order.billing.email }
    )
    return false
  }

  const from =
    process.env.SMTP_FROM ??
    `"${settings.company.firmenname}" <${settings.company.kontaktEmail}>`

  const withInvoice = options.attachInvoice && Boolean(options.pdfBuffer)
  const subject = withInvoice
    ? `${settings.company.firmenname} — Ihre Rechnung ${order.orderId}`
    : `${settings.company.firmenname} — Bestellbestaetigung ${order.orderId}`

  const text = buildPlainBody(order, settings.company.firmenname, withInvoice)

  try {
    const transporter = buildTransporter()
    await transporter.sendMail({
      from,
      to: order.billing.email,
      subject,
      text,
      attachments:
        withInvoice && options.pdfBuffer
          ? [
              {
                filename: `Rechnung-${order.orderId}.pdf`,
                content: options.pdfBuffer,
                contentType: "application/pdf",
              },
            ]
          : undefined,
    })
    console.info(
      `E-Mail: Bestätigung gesendet (${order.orderId} → ${order.billing.email}, Rechnung: ${withInvoice}).`
    )
    return true
  } catch (error) {
    console.error(
      `E-Mail: Bestellbestätigung konnte nicht gesendet werden (${order.orderId}).`,
      error
    )
    throw error
  }
}
