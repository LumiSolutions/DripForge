import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { getStripe, isStripeConfigured } from "@/lib/stripe/client"
import { fulfillShopOrderFromStripeSession } from "@/lib/stripe/fulfill-shop-session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Erfolgsseiten-Fallback für Stripe Checkout.
 * Ruft die Session ab, prüft payment_status === 'paid', markiert die
 * Bestellung als bezahlt und sendet Kunden-/Admin-Mails (idempotent).
 *
 * Body: { sessionId: string }
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Stripe nicht konfiguriert." },
      { status: 503 }
    )
  }

  try {
    const body = (await request.json()) as {
      sessionId?: string
      paymentIntentId?: string
    }

    const sessionId = body.sessionId?.trim()
    const paymentIntentId = body.paymentIntentId?.trim()

    if (!sessionId && !paymentIntentId) {
      return NextResponse.json(
        { ok: false, error: "sessionId fehlt." },
        { status: 400 }
      )
    }

    await warmCosmosInfrastructure()
    const stripe = getStripe()

    let session: Stripe.Checkout.Session | null = null

    if (sessionId) {
      session = await stripe.checkout.sessions.retrieve(sessionId)
    } else if (paymentIntentId) {
      const list = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
        limit: 1,
      })
      session = list.data[0] ?? null
    }

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Checkout-Session nicht gefunden." },
        { status: 404 }
      )
    }

    if (session.payment_status !== "paid") {
      console.warn("[confirm-stripe] Session noch nicht paid.", {
        sessionId: session.id,
        payment_status: session.payment_status,
        status: session.status,
      })
      return NextResponse.json(
        {
          ok: false,
          error: `Zahlung noch nicht bestätigt (payment_status=${session.payment_status}).`,
          sessionId: session.id,
          payment_status: session.payment_status,
        },
        { status: 402 }
      )
    }

    const result = await fulfillShopOrderFromStripeSession(session)

    if (!result.ok) {
      console.error("[confirm-stripe] Fulfillment fehlgeschlagen.", result)
      return NextResponse.json(
        {
          ok: false,
          orderId: result.orderId,
          error: result.error,
          emails: result.emails,
          sessionId: session.id,
        },
        { status: 400 }
      )
    }

    console.info("[confirm-stripe] OK", {
      orderId: result.orderId,
      fulfilled: result.fulfilled,
      emails: result.emails,
      sessionId: session.id,
    })

    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      fulfilled: result.fulfilled,
      emails: result.emails,
      sessionId: session.id,
      payment_status: session.payment_status,
    })
  } catch (error) {
    console.error("[confirm-stripe] Fehler.", error)
    const message =
      error instanceof Error
        ? error.message
        : "Stripe-Bestätigung fehlgeschlagen."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
