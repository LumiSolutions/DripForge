/**
 * Zentraler Bestell-E-Mail-Versand für alle Zahlungsarten
 * (Stripe, TWINT, Kauf auf Rechnung).
 *
 * Auf Azure SWA: Checkout-APIs nutzen `queueOrderEmails` (nicht-blockierend),
 * damit die HTTP-Response sofort zurückgeht und der SMTP-Socket Zeit hat.
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
 * Sendet Kunden- + Admin-Mail (parallel unabhängig).
 * Für API-Routen auf Azure bevorzugt `queueOrderEmails` nutzen.
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
      "CRITICAL_SMTP_ERROR:",
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

  try {
    if (!customerEmail) {
      console.error(
        "SMTP Customer Mail Error:",
        new Error(`Keine Kunden-E-Mail für Bestellung ${orderNumber}`)
      )
    } else {
      console.log(">>> SMTP: Starte Versand an Kunde:", customerEmail)
      customerSent = Boolean(await notifyOrderReceived(orderForMail, settings))
      if (customerSent) {
        console.log(">>> SMTP: Kunde ERFOLGREICH gesendet")
      } else {
        console.error(
          ">>> SMTP: Kunde FEHLGESCHLAGEN (sendSmtpMail returned false)",
          { orderId: orderNumber, to: customerEmail }
        )
      }
    }
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code || "")
        : ""
    const message = err instanceof Error ? err.message : String(err)
    if (/ETIMEDOUT|ECONNREFUSED|ESOCKET|ECONNRESET/i.test(code + message)) {
      console.error("SMTP Connection Failed:", code, message)
    }
    console.error("SMTP Customer Mail Error:", err)
    console.error("CRITICAL_SMTP_ERROR:", err)
  }

  try {
    console.log(
      ">>> SMTP: Starte Versand an Admin:",
      process.env.ADMIN_NOTIFY_EMAIL || adminEmail
    )
    adminSent = Boolean(
      await notifyAdminNewOrder(orderForMail, settings, { to: adminEmail })
    )
    if (adminSent) {
      console.log(">>> SMTP: Admin ERFOLGREICH gesendet")
    } else {
      console.error(
        ">>> SMTP: Admin FEHLGESCHLAGEN (sendSmtpMail returned false)",
        { orderId: orderNumber, to: adminEmail }
      )
    }
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code || "")
        : ""
    const message = err instanceof Error ? err.message : String(err)
    if (/ETIMEDOUT|ECONNREFUSED|ESOCKET|ECONNRESET/i.test(code + message)) {
      console.error("SMTP Connection Failed:", code, message)
    }
    console.error("SMTP Admin Mail Error:", err)
    console.error("CRITICAL_SMTP_ERROR:", err)
  }

  console.log("[OrderEmail] Versand abgeschlossen", {
    orderId: orderNumber,
    customerSent,
    adminSent,
  })

  return { customerSent, adminSent }
}

/**
 * Nicht-blockierender Versand für Azure SWA / Serverless:
 * Checkout-Response geht sofort zurück; SMTP läuft danach weiter
 * (Next.js `after()` hält die Execution am Leben, Fallback: void Promise).
 */
export function queueOrderEmails(
  order: StoredOrder,
  settings?: AdminSettings
): void {
  console.log(
    "[OrderEmail] queueOrderEmails (non-blocking) für",
    order.orderId
  )

  const run = () =>
    sendOrderEmails(order, settings).catch((err) => {
      console.error("CRITICAL_SMTP_ERROR:", err)
    })

  try {
    // Dynamisch: after() nur im Request-Kontext verfügbar
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { after } = require("next/server") as {
      after?: (task: Promise<unknown> | (() => void | Promise<unknown>)) => void
    }
    if (typeof after === "function") {
      after(() => run())
      return
    }
  } catch {
    // Fallback unten
  }

  void run()
}

/** @deprecated Alias — bitte `sendOrderEmails` / `queueOrderEmails` verwenden. */
export const sendOrderConfirmationEmails = sendOrderEmails

/** @deprecated Alias — bitte `sendOrderEmails` / `queueOrderEmails` verwenden. */
export const sendOrderConfirmation = sendOrderEmails
