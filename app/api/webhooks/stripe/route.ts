import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { fulfillPointsPurchase } from "@/lib/shop/points-purchase"
import { getStripe, isStripeConfigured } from "@/lib/stripe/client"
import { fulfillShopOrderFromStripeSession } from "@/lib/stripe/fulfill-shop-session"
import {
  cosmosGetProjectSupporterBySessionId,
  cosmosSaveProjectSupporter,
} from "@/lib/support/cosmos-supporters"
import {
  SUPPORTER_DOC_TYPE,
  normalizeSupportCategory,
  type ProjectSupporter,
} from "@/lib/support/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function persistCompletedCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<ProjectSupporter | null> {
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return null
  }

  const sessionId = session.id
  const existing = await cosmosGetProjectSupporterBySessionId(sessionId)
  if (existing?.status === "completed") return existing

  const email =
    session.customer_details?.email ??
    session.metadata?.supporterEmail ??
    session.customer_email ??
    ""
  const name =
    session.metadata?.supporterName ??
    session.customer_details?.name ??
    "Supporter"

  const amountCents =
    session.amount_total ??
    (session.metadata?.amountChf
      ? Math.round(Number(session.metadata.amountChf) * 100)
      : 0)

  if (!email || !amountCents) return null

  const category = normalizeSupportCategory(session.metadata?.supportCategory)

  const supporter: ProjectSupporter = {
    id: sessionId,
    docType: SUPPORTER_DOC_TYPE,
    name: String(name).trim().slice(0, 120) || "Supporter",
    email: email.trim().toLowerCase(),
    amountChf: Math.round(amountCents) / 100,
    amountCents: Math.round(amountCents),
    currency: "chf",
    category,
    stripeSessionId: sessionId,
    stripePaymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    status: "completed",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }

  return cosmosSaveProjectSupporter(supporter)
}

/**
 * Stripe Webhook — checkout.session.completed
 * Markiert Bestellungen als bezahlt und löst Bestätigungs-E-Mails über SMTP aus.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe nicht konfiguriert." }, { status: 503 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    console.error("Stripe Webhook: STRIPE_WEBHOOK_SECRET fehlt.")
    return NextResponse.json({ error: "Webhook nicht konfiguriert." }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Signatur fehlt." }, { status: 400 })
  }

  const body = await request.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error("Stripe Webhook: Signatur ungültig.", error)
    return NextResponse.json({ error: "Ungültige Signatur." }, { status: 400 })
  }

  try {
    await warmCosmosInfrastructure()

    if (
      event.type === "checkout.session.completed" ||
      event.type === "payment_intent.succeeded"
    ) {
      if (event.type === "payment_intent.succeeded") {
        // Shop-Orders werden über checkout.session.completed abgewickelt.
        // payment_intent.succeeded nur loggen — Session-Fulfillment hat metadata.purpose.
        console.info("Stripe Webhook: payment_intent.succeeded empfangen.", {
          paymentIntentId: (event.data.object as Stripe.PaymentIntent).id,
        })
        return NextResponse.json({ received: true })
      }

      const session = event.data.object as Stripe.Checkout.Session
      const purpose = session.metadata?.purpose

      if (purpose === "support-journey") {
        await persistCompletedCheckoutSession(session)
      } else if (purpose === "shop-order") {
        console.info(
          "Stripe Webhook: checkout.session.completed (shop-order) — Fulfillment + E-Mails",
          {
            sessionId: session.id,
            orderId: session.metadata?.orderId ?? null,
            payment_status: session.payment_status,
          }
        )
        const result = await fulfillShopOrderFromStripeSession(session)
        if (!result.ok) {
          console.error("Stripe Webhook: Shop-Fulfillment fehlgeschlagen.", {
            sessionId: session.id,
            error: result.error,
            orderId: result.orderId,
          })
        } else {
          console.info("Stripe Webhook: Shop-Order verarbeitet (inkl. Mail-Aufruf).", {
            orderId: result.orderId,
            fulfilled: result.fulfilled,
            emails: result.emails,
          })
        }
      } else if (purpose === "points-purchase") {
        const purchaseId = session.metadata?.purchaseId?.trim()
        const email = session.metadata?.userId?.trim()
        const points = Number(session.metadata?.points ?? 0)
        if (purchaseId && email && points > 0) {
          await fulfillPointsPurchase(purchaseId, email, points, session.id)
        }
      } else {
        console.warn("Stripe Webhook: Unbekannter checkout purpose.", {
          purpose: purpose ?? null,
          sessionId: session.id,
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Stripe Webhook: Verarbeitung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Webhook-Verarbeitung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
