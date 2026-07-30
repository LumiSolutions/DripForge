import type Stripe from "stripe"
import { getOrderById, getSettings } from "@/lib/admin/db"
import type { StoredOrder } from "@/lib/admin/types"
import { claimInboundOrderEmailSend } from "@/lib/email/claim-inbound-emails"
import { queueOrderEmails } from "@/lib/email/send-order-emails"
import { fulfillPaidShopOrder } from "@/lib/shop/order-processing"

export function resolveStripeCustomerEmail(
  session: Stripe.Checkout.Session
): string | null {
  const raw =
    session.customer_details?.email?.trim() ||
    session.customer_email?.trim() ||
    session.metadata?.customerEmail?.trim() ||
    ""
  return raw ? raw.toLowerCase() : null
}

/**
 * Kunden- + Admin-Mails nach Stripe — dieselbe Funktion wie Rechnung/TWINT.
 * Genau einmal dank claimInboundOrderEmailSend.
 */
export async function sendShopOrderEmailsAfterStripe(
  orderId: string,
  session: Stripe.Checkout.Session,
  customerEmail: string | null
): Promise<{ sent: boolean; skipped: boolean; customerSent: boolean; adminSent: boolean }> {
  const settings = await getSettings()
  const order = await getOrderById(orderId)
  if (!order) {
    console.error(
      `Stripe: Bestellung ${orderId} für E-Mail-Versand nicht gefunden.`
    )
    return { sent: false, skipped: false, customerSent: false, adminSent: false }
  }

  if (order.emailNotifications?.receivedAt) {
    console.info(
      `Stripe: Eingangsmails bereits versendet (${orderId}), überspringe.`
    )
    return { sent: false, skipped: true, customerSent: false, adminSent: false }
  }

  const claimed = await claimInboundOrderEmailSend(orderId)
  if (!claimed) {
    console.info(
      `Stripe: Eingangsmails bereits geclaimed (${orderId}), überspringe Doppelversand.`
    )
    return { sent: false, skipped: true, customerSent: false, adminSent: false }
  }

  const orderForEmail: StoredOrder = {
    ...order,
    paymentConfirmed: true,
    stripeSessionId: order.stripeSessionId || session.id,
    billing: {
      ...order.billing,
      email: customerEmail || order.billing.email,
    },
  }

  console.info("[Stripe] Rufe queueOrderEmails auf (non-blocking)", {
    orderId,
    customerEmail: orderForEmail.billing.email,
    stripeSessionId: session.id,
    paymentMethod: orderForEmail.paymentMethod,
  })

  try {
    console.log("Sending order emails for order:", orderForEmail.orderId)
    queueOrderEmails(orderForEmail, settings)
    return {
      sent: true,
      skipped: false,
      customerSent: false,
      adminSent: false,
    }
  } catch (error) {
    console.error("Bestell-Mail Fehler:", error)
    console.error("CRITICAL_SMTP_ERROR:", error)
    console.error(
      `[Stripe] SMTP-Versand fehlgeschlagen (${orderId}) — Bestellung bleibt erhalten.`,
      error
    )
    return { sent: false, skipped: false, customerSent: false, adminSent: false }
  }
}

export async function fulfillShopOrderFromStripeSession(
  session: Stripe.Checkout.Session
): Promise<{
  ok: boolean
  orderId: string | null
  fulfilled: boolean
  emails: {
    sent: boolean
    skipped: boolean
    customerSent: boolean
    adminSent: boolean
  }
  error?: string
}> {
  const purpose = session.metadata?.purpose
  if (purpose !== "shop-order") {
    return {
      ok: false,
      orderId: null,
      fulfilled: false,
      emails: {
        sent: false,
        skipped: false,
        customerSent: false,
        adminSent: false,
      },
      error: "Session ist keine Shop-Bestellung.",
    }
  }

  const orderId = session.metadata?.orderId?.trim() || null
  if (!orderId) {
    return {
      ok: false,
      orderId: null,
      fulfilled: false,
      emails: {
        sent: false,
        skipped: false,
        customerSent: false,
        adminSent: false,
      },
      error: "metadata.orderId fehlt.",
    }
  }

  const paid =
    session.payment_status === "paid" || session.status === "complete"
  if (!paid) {
    return {
      ok: false,
      orderId,
      fulfilled: false,
      emails: {
        sent: false,
        skipped: false,
        customerSent: false,
        adminSent: false,
      },
      error: "Zahlung noch nicht bestätigt.",
    }
  }

  const amountCents = session.amount_total ?? 0
  const totalChf =
    amountCents > 0
      ? Math.round(amountCents) / 100
      : Number(session.metadata?.totalChf ?? 0)

  const customerEmail = resolveStripeCustomerEmail(session)

  // 1) Bestellung als bezahlt speichern (Fehler hier → ok:false)
  const fulfillResult = await fulfillPaidShopOrder(orderId, {
    stripeSessionId: session.id,
    userId:
      session.metadata?.accountEmail?.trim() ||
      session.metadata?.userId?.trim() ||
      null,
    totalChf,
    customerEmail,
    skipInboundEmails: true,
  })

  // 2) Mails immer versuchen — Fehler loggen, Bestellung bleibt
  console.info("[Stripe] Starte einheitlichen Order-Mailversand nach Fulfillment", {
    orderId,
    fulfilled: fulfillResult.fulfilled,
    sessionId: session.id,
  })

  const emails = await sendShopOrderEmailsAfterStripe(
    orderId,
    session,
    customerEmail
  )

  return {
    ok: true,
    orderId,
    fulfilled: fulfillResult.fulfilled,
    emails,
  }
}
