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
 * Sendet sofort zwei E-Mails per Hostpoint SMTP:
 * 1) Kundenmail (Bestelleingang / Vorkasse-Hinweis)
 * 2) Admin-Benachrichtigung an shop@dripforge.ch
 *
 * Fehler werden geloggt — die Bestellung bleibt trotzdem gespeichert.
 */
export async function sendOrderEmails(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<SendOrderEmailsResult> {
  try {
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
        "SMTP Mail Error:",
        new Error(
          `SMTP nicht konfiguriert (SMTP_USER/SMTP_PASS) — Versand übersprungen (${order.orderId}).`
        )
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
        console.error("SMTP Mail Error:", result.reason)
        console.error(`[OrderEmail] ${label}: fehlgeschlagen`, {
          orderId: order.orderId,
          reason: result.reason,
        })
      }
    })

    if (!customer && !admin) {
      console.error(
        "SMTP Mail Error:",
        new Error(
          `Beide Bestell-Mails fehlgeschlagen oder übersprungen (${order.orderId}).`
        )
      )
    }

    console.log("[OrderEmail] Versand abgeschlossen", {
      orderId: order.orderId,
      customerSent: customer,
      adminSent: admin,
    })

    return { customerSent: customer, adminSent: admin }
  } catch (error) {
    console.error("SMTP Mail Error:", error)
    return { customerSent: false, adminSent: false }
  }
}

/** @deprecated Alias — bitte `sendOrderEmails` verwenden. */
export const sendOrderConfirmationEmails = sendOrderEmails

/** @deprecated Alias — bitte `sendOrderEmails` verwenden. */
export const sendOrderConfirmation = sendOrderEmails
