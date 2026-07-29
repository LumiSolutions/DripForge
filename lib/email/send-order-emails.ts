/**
 * Zentraler Bestell-E-Mail-Versand für alle Zahlungsarten
 * (Stripe, TWINT, Kauf auf Rechnung).
 *
 * Alle Checkout-Pfade sollen nur `sendOrderEmails(order)` nutzen.
 */
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { notifyAdminNewOrder } from "@/lib/email/admin-inbound-notifications"
import { notifyOrderReceived } from "@/lib/email/order-notifications"
import { resolvePaymentStatusLabel } from "@/lib/email/order-email-summary"
import { getSmtpDiagnostics, isSmtpConfigured } from "@/lib/email/smtp"

export type SendOrderEmailsResult = {
  customerSent: boolean
  adminSent: boolean
}

/**
 * Sendet sofort zwei E-Mails per Hostpoint SMTP (parallel, getrennt fehlertolerant):
 * 1) Kundenmail
 * 2) Admin-Benachrichtigung
 *
 * Scheitert eine Mail (z. B. PDF/Anhang), wird die andere trotzdem versucht.
 */
export async function sendOrderEmails(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<SendOrderEmailsResult> {
  const smtpDiag = isSmtpConfigured() ? getSmtpDiagnostics() : null

  console.log("[OrderEmail] Starte sendOrderEmails", {
    orderId: order.orderId,
    paymentMethod: order.paymentMethod,
    paymentConfirmed: Boolean(order.paymentConfirmed),
    customerEmail: order.billing.email,
    paymentStatus: resolvePaymentStatusLabel(order),
    smtpConfigured: Boolean(smtpDiag),
    smtpHost: smtpDiag?.host ?? "(nicht konfiguriert)",
    smtpPort: smtpDiag?.port ?? null,
    smtpSecure: smtpDiag?.secure ?? null,
    smtpFrom: smtpDiag?.from ?? null,
    smtpUser: smtpDiag?.configuredUser ?? null,
  })

  if (!isSmtpConfigured()) {
    console.error(
      "SMTP Customer Mail Error:",
      new Error(
        `SMTP nicht konfiguriert (SMTP_USER/SMTP_PASS) — Versand übersprungen (${order.orderId}).`
      )
    )
    console.error(
      "SMTP Admin Mail Error:",
      new Error(
        `SMTP nicht konfiguriert (SMTP_USER/SMTP_PASS) — Versand übersprungen (${order.orderId}).`
      )
    )
    return { customerSent: false, adminSent: false }
  }

  let customerSent = false
  let adminSent = false

  // Parallel, aber jeweils eigener try/catch — eine Seite darf die andere nie blockieren
  const [customerResult, adminResult] = await Promise.all([
    (async (): Promise<boolean> => {
      try {
        const sent = await notifyOrderReceived(order, settings)
        console.log("[OrderEmail] customer: ok", {
          orderId: order.orderId,
          sent,
        })
        return Boolean(sent)
      } catch (err) {
        console.error("SMTP Customer Mail Error:", err)
        return false
      }
    })(),
    (async (): Promise<boolean> => {
      try {
        const sent = await notifyAdminNewOrder(order, settings)
        console.log("[OrderEmail] admin: ok", {
          orderId: order.orderId,
          sent,
        })
        return Boolean(sent)
      } catch (err) {
        console.error("SMTP Admin Mail Error:", err)
        return false
      }
    })(),
  ])

  customerSent = customerResult
  adminSent = adminResult

  if (!customerSent && !adminSent) {
    console.error(
      "SMTP Mail Error:",
      new Error(
        `Beide Bestell-Mails fehlgeschlagen oder übersprungen (${order.orderId}).`
      )
    )
  }

  console.log("[OrderEmail] Versand abgeschlossen", {
    orderId: order.orderId,
    customerSent,
    adminSent,
  })

  return { customerSent, adminSent }
}

/** @deprecated Alias — bitte `sendOrderEmails` verwenden. */
export const sendOrderConfirmationEmails = sendOrderEmails

/** @deprecated Alias — bitte `sendOrderEmails` verwenden. */
export const sendOrderConfirmation = sendOrderEmails
