/**
 * Zentraler Bestell-E-Mail-Versand für alle Zahlungsarten
 * (Stripe, TWINT, Kauf auf Rechnung).
 *
 * PDF-Anhänge gehören NICHT hierher — Eingangsmails gehen ohne Anhang.
 * Kunden- und Admin-Versand sind voneinander unabhängig.
 */
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { notifyAdminNewOrder } from "@/lib/email/admin-inbound-notifications"
import { notifyOrderReceived } from "@/lib/email/order-notifications"
import { resolvePaymentStatusLabel } from "@/lib/email/order-email-summary"
import { getSmtpDiagnostics, isSmtpConfigured } from "@/lib/email/smtp"

export const ORDER_MAIL_FROM = "DripForge <shop@dripforge.ch>"

export type SendOrderEmailsResult = {
  customerSent: boolean
  adminSent: boolean
}

/** Kunden-Empfänger: billing.email (StoredOrder) + optionale Aliase. */
export function resolveOrderCustomerEmail(order: StoredOrder): string {
  const extended = order as StoredOrder & {
    customerEmail?: string
    email?: string
  }
  return (
    extended.customerEmail?.trim() ||
    extended.email?.trim() ||
    order.billing?.email?.trim() ||
    order.accountEmail?.trim() ||
    ""
  )
}

/** Admin-Empfänger: ENV mit festem Fallback. */
export function resolveOrderAdminEmail(): string {
  const fromEnv =
    process.env.ADMIN_NOTIFY_EMAIL?.trim().replace(/^["']|["']$/g, "") ||
    process.env.ADMIN_EMAIL?.trim().replace(/^["']|["']$/g, "") ||
    ""
  return fromEnv || "shop@dripforge.ch"
}

/**
 * Sendet sofort zwei E-Mails per Hostpoint SMTP (parallel, getrennt fehlertolerant).
 * Scheitert eine Mail, wird die andere trotzdem versucht — ohne PDF-Abhängigkeit.
 */
export async function sendOrderEmails(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<SendOrderEmailsResult> {
  const orderNumber = order.orderId
  console.log("Sending order emails for order:", orderNumber)

  const customerEmail = resolveOrderCustomerEmail(order)
  const adminEmail = resolveOrderAdminEmail()
  const smtpDiag = isSmtpConfigured() ? getSmtpDiagnostics() : null

  console.log("[OrderEmail] Starte sendOrderEmails", {
    orderId: orderNumber,
    paymentMethod: order.paymentMethod,
    paymentConfirmed: Boolean(order.paymentConfirmed),
    customerEmail,
    adminEmail,
    from: ORDER_MAIL_FROM,
    paymentStatus: resolvePaymentStatusLabel(order),
    smtpConfigured: Boolean(smtpDiag),
    smtpHost: smtpDiag?.host ?? "(nicht konfiguriert)",
    smtpPort: smtpDiag?.port ?? null,
    smtpSecure: smtpDiag?.secure ?? null,
  })

  if (!isSmtpConfigured()) {
    console.error(
      "Bestell-Mail Fehler:",
      new Error(
        `SMTP nicht konfiguriert (SMTP_USER/SMTP_PASS) — Versand übersprungen (${orderNumber}).`
      )
    )
    return { customerSent: false, adminSent: false }
  }

  const orderForMail: StoredOrder = {
    ...order,
    billing: {
      ...order.billing,
      email: customerEmail || order.billing.email,
    },
  }

  let customerSent = false
  let adminSent = false

  // Unabhängige try/catch — PDF/Anhang darf hier nie blockieren
  try {
    if (!customerEmail) {
      console.error(
        "SMTP Customer Mail Error:",
        new Error(`Keine Kunden-E-Mail für Bestellung ${orderNumber}`)
      )
    } else {
      customerSent = Boolean(await notifyOrderReceived(orderForMail, settings))
      console.log("[OrderEmail] customer: ok", {
        orderId: orderNumber,
        sent: customerSent,
        to: customerEmail,
      })
    }
  } catch (err) {
    console.error("SMTP Customer Mail Error:", err)
    console.error("Bestell-Mail Fehler:", err)
  }

  try {
    adminSent = Boolean(
      await notifyAdminNewOrder(orderForMail, settings, { to: adminEmail })
    )
    console.log("[OrderEmail] admin: ok", {
      orderId: orderNumber,
      sent: adminSent,
      to: adminEmail,
    })
  } catch (err) {
    console.error("SMTP Admin Mail Error:", err)
    console.error("Bestell-Mail Fehler:", err)
  }

  if (!customerSent && !adminSent) {
    console.error(
      "Bestell-Mail Fehler:",
      new Error(
        `Beide Bestell-Mails fehlgeschlagen oder übersprungen (${orderNumber}).`
      )
    )
  }

  console.log("[OrderEmail] Versand abgeschlossen", {
    orderId: orderNumber,
    customerSent,
    adminSent,
  })

  return { customerSent, adminSent }
}

/** @deprecated Alias — bitte `sendOrderEmails` verwenden. */
export const sendOrderConfirmationEmails = sendOrderEmails

/** @deprecated Alias — bitte `sendOrderEmails` verwenden. */
export const sendOrderConfirmation = sendOrderEmails
