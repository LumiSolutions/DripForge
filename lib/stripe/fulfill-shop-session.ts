import type Stripe from "stripe"
import { getOrderById, getSettings } from "@/lib/admin/db"
import type { StoredOrder } from "@/lib/admin/types"
import {
  fulfillPaidShopOrder,
  sendInboundOrderEmailsSafe,
} from "@/lib/shop/order-processing"

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
 * Kunden- + Admin-Eingangsmails nach Stripe-Zahlung
 * (gleiche Templates wie «Auf Rechnung»).
 */
export async function sendShopOrderEmailsAfterStripe(
  orderId: string,
  session: Stripe.Checkout.Session,
  customerEmail: string | null
): Promise<{ sent: boolean; skipped: boolean }> {
  const settings = await getSettings()
  const order = await getOrderById(orderId)
  if (!order) {
    console.error(
      `Stripe: Bestellung ${orderId} für E-Mail-Versand nicht gefunden.`
    )
    return { sent: false, skipped: false }
  }

  // Idempotent: Kundenmail bereits versendet → nichts erneut senden
  if (order.emailNotifications?.receivedAt) {
    console.info(
      `Stripe: Eingangsmails bereits versendet (${orderId}), überspringe.`
    )
    return { sent: false, skipped: true }
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

  console.log("[Stripe] Starte SMTP-Eingangsmails (wie Auf Rechnung)", {
    orderId,
    customerEmail: orderForEmail.billing.email,
    stripeSessionId: session.id,
  })

  await sendInboundOrderEmailsSafe(orderForEmail, settings)
  return { sent: true, skipped: false }
}

export async function fulfillShopOrderFromStripeSession(
  session: Stripe.Checkout.Session
): Promise<{
  ok: boolean
  orderId: string | null
  fulfilled: boolean
  emails: { sent: boolean; skipped: boolean }
  error?: string
}> {
  const purpose = session.metadata?.purpose
  if (purpose !== "shop-order") {
    return {
      ok: false,
      orderId: null,
      fulfilled: false,
      emails: { sent: false, skipped: false },
      error: "Session ist keine Shop-Bestellung.",
    }
  }

  const orderId = session.metadata?.orderId?.trim() || null
  if (!orderId) {
    return {
      ok: false,
      orderId: null,
      fulfilled: false,
      emails: { sent: false, skipped: false },
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
      emails: { sent: false, skipped: false },
      error: "Zahlung noch nicht bestätigt.",
    }
  }

  const amountCents = session.amount_total ?? 0
  const totalChf =
    amountCents > 0
      ? Math.round(amountCents) / 100
      : Number(session.metadata?.totalChf ?? 0)

  const customerEmail = resolveStripeCustomerEmail(session)

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

  let emails = { sent: false, skipped: false }
  try {
    emails = await sendShopOrderEmailsAfterStripe(
      orderId,
      session,
      customerEmail
    )
  } catch (emailError) {
    console.error("Stripe: SMTP-Versand fehlgeschlagen.", emailError)
  }

  return {
    ok: true,
    orderId,
    fulfilled: fulfillResult.fulfilled,
    emails,
  }
}
