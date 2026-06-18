import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripe, isStripeConfigured } from "@/lib/stripe/client"
import {
  cosmosGetProjectSupporterBySessionId,
  cosmosSaveProjectSupporter,
} from "@/lib/support/cosmos-supporters"
import {
  SUPPORTER_DOC_TYPE,
  normalizeSupportCategory,
  type ProjectSupporter,
} from "@/lib/support/types"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { fulfillPaidShopOrder } from "@/lib/shop/order-processing"
import { fulfillPointsPurchase } from "@/lib/shop/points-purchase"

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
    console.error("Stripe Webhook: Signatur ungueltig.", error)
    return NextResponse.json({ error: "Ungueltige Signatur." }, { status: 400 })
  }

  try {
    await warmCosmosInfrastructure()

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const purpose = session.metadata?.purpose

      if (purpose === "support-journey") {
        await persistCompletedCheckoutSession(session)
      } else if (purpose === "shop-order") {
        const orderId = session.metadata?.orderId?.trim()
        if (orderId) {
          const amountCents = session.amount_total ?? 0
          const totalChf =
            amountCents > 0
              ? Math.round(amountCents) / 100
              : Number(session.metadata?.totalChf ?? 0)
          await fulfillPaidShopOrder(orderId, {
            stripeSessionId: session.id,
            userId: session.metadata?.userId?.trim() || null,
            totalChf,
          })
        }
      } else if (purpose === "points-purchase") {
        const purchaseId = session.metadata?.purchaseId?.trim()
        const email = session.metadata?.userId?.trim()
        const points = Number(session.metadata?.points ?? 0)
        if (purchaseId && email && points > 0) {
          await fulfillPointsPurchase(purchaseId, email, points, session.id)
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Stripe Webhook: Verarbeitung fehlgeschlagen.", error)
    return NextResponse.json({ error: "Webhook-Verarbeitung fehlgeschlagen." }, { status: 500 })
  }
}
