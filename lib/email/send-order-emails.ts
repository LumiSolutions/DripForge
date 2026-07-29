/**
 * Einheitlicher Bestell-E-Mail-Versand für alle Zahlungsarten
 * (Stripe, TWINT-Link, Kauf auf Rechnung, …).
 *
 * Alle Checkout-Pfade sollen nur diese Funktion nutzen, damit
 * Betreff/Inhalt zentral gepflegt werden.
 */
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { notifyAdminNewOrder } from "@/lib/email/admin-inbound-notifications"
import { notifyOrderReceived } from "@/lib/email/order-notifications"
import { resolvePaymentStatusLabel } from "@/lib/email/order-email-summary"
import { isSmtpConfigured } from "@/lib/email/smtp"

export type SendOrderEmailsResult = {
  customerSent: boolean
  adminSent: boolean
}

/**
 * Sendet Kundenbestätigung + Admin-Benachrichtigung per SMTP (Nodemailer/Hostpoint).
 * Fehler werden geloggt — die Bestellung bleibt trotzdem gespeichert.
 */
export async function sendOrderConfirmationEmails(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<SendOrderEmailsResult> {
  console.log("[OrderEmail] Starte einheitlichen Bestell-Mailversand", {
    orderId: order.orderId,
    paymentMethod: order.paymentMethod,
    paymentConfirmed: Boolean(order.paymentConfirmed),
    customerEmail: order.billing.email,
    paymentStatus: resolvePaymentStatusLabel(order),
    smtpConfigured: isSmtpConfigured(),
    smtpHost: process.env.SMTP_HOST?.trim() || "(default asmtp.mail.hostpoint.ch)",
    smtpPort: process.env.SMTP_PORT?.trim() || "(default)",
  })

  if (!isSmtpConfigured()) {
    console.error(
      `[OrderEmail] SMTP nicht konfiguriert (SMTP_USER/SMTP_PASS) — Versand übersprungen (${order.orderId}).`
    )
    return { customerSent: false, adminSent: false }
  }

  const results = await Promise.allSettled([
    notifyOrderReceived(order, settings),
    notifyAdminNewOrder(order, settings),
  ])

  const customer =
    results[0].status === "fulfilled" ? Boolean(results[0].value) : false
  const admin =
    results[1].status === "fulfilled" ? Boolean(results[1].value) : false

  results.forEach((result, index) => {
    const label = index === 0 ? "customer" : "admin"
    if (result.status === "fulfilled") {
      console.log(`[OrderEmail] ${label}: ok`, {
        orderId: order.orderId,
        sent: result.value,
      })
    } else {
      console.error(`[OrderEmail] ${label}: fehlgeschlagen`, {
        orderId: order.orderId,
        reason: result.reason,
      })
    }
  })

  return { customerSent: customer, adminSent: admin }
}
