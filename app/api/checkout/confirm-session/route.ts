import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { getStripe, isStripeConfigured } from "@/lib/stripe/client"
import { fulfillShopOrderFromStripeSession } from "@/lib/stripe/fulfill-shop-session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Fallback nach Stripe-Redirect auf die Erfolgsseite.
 * Primär soll der Webhook fulfill + Mails auslösen; falls der Webhook
 * lokal/Azure verzögert oder geblockt ist, holt diese Route nach.
 *
 * Body: { sessionId: string }
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe nicht konfiguriert.", ok: false },
      { status: 503 }
    )
  }

  try {
    const body = (await request.json()) as {
      sessionId?: string
      paymentIntentId?: string
    }

    const sessionId = body.sessionId?.trim()
    if (!sessionId && !body.paymentIntentId?.trim()) {
      return NextResponse.json(
        { error: "sessionId fehlt.", ok: false },
        { status: 400 }
      )
    }

    await warmCosmosInfrastructure()
    const stripe = getStripe()

    let session: Stripe.Checkout.Session | null = null

    if (sessionId) {
      session = await stripe.checkout.sessions.retrieve(sessionId)
    } else if (body.paymentIntentId?.trim()) {
      const list = await stripe.checkout.sessions.list({
        payment_intent: body.paymentIntentId.trim(),
        limit: 1,
      })
      session = list.data[0] ?? null
    }

    if (!session) {
      return NextResponse.json(
        { error: "Checkout-Session nicht gefunden.", ok: false },
        { status: 404 }
      )
    }

    const result = await fulfillShopOrderFromStripeSession(session)

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          orderId: result.orderId,
          error: result.error,
          emails: result.emails,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      fulfilled: result.fulfilled,
      emails: result.emails,
      sessionId: session.id,
    })
  } catch (error) {
    console.error("Stripe confirm-session fehlgeschlagen.", error)
    const message =
      error instanceof Error
        ? error.message
        : "Bestätigung der Stripe-Session fehlgeschlagen."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
