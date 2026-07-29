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
import { getSmtpDiagnostics, isSmtpConfigured } from "@/lib/email/smtp"

export type SendOrderEmailsResult = {
  customerSent: boolean
  adminSent: boolean
}

/**
 * Sendet Kundenbestätigung + Admin-Benachrichtigung per SMTP (Nodemailer/Hostpoint).
 * Fehler werden geloggt — die Bestellung bleibt trotzdem gespeichert.
 *
 * Alias: sendOrderConfirmation (für klare Aufrufe in API-Routen).
 */
export async function sendOrderConfirmationEmails(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<SendOrderEmailsResult> {
  const smtpDiag = isSmtpConfigured() ? getSmtpDiagnostics() : null

  console.log("[OrderEmail] Starte einheitlichen Bestell-Mailversand", {
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
      `[OrderEmail] SMTP nicht konfiguriert (SMTP_USER/SMTP_PASS) — Versand übersprungen (${order.orderId}).`
    )
    return { customerSent: false, adminSent: false }
  }

  console.log("[OrderEmail] Rufe Kunden- + Admin-Mail synchron (await) auf…", {
    orderId: order.orderId,
  })

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

  console.log("[OrderEmail] Versand abgeschlossen", {
    orderId: order.orderId,
    customerSent: customer,
    adminSent: admin,
  })

  return { customerSent: customer, adminSent: admin }
}

/** Klarer Alias — nach erfolgreichem DB-Save awaited aufrufen. */
export const sendOrderConfirmation = sendOrderConfirmationEmails
