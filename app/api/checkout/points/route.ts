import { NextResponse } from "next/server"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import {
  resolvePointsPurchaseFromRequest,
  type PointsPurchaseRequest,
} from "@/lib/shop/points-purchase"
import { getSiteOrigin, getStripe, isStripeConfigured } from "@/lib/stripe/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe ist noch nicht konfiguriert." },
      { status: 503 }
    )
  }

  try {
    await warmCosmosInfrastructure()

    const body = (await request.json()) as PointsPurchaseRequest
    if (body.paymentMethod !== "card") {
      return NextResponse.json(
        { error: "Diese Route ist nur für Kartenzahlung vorgesehen." },
        { status: 400 }
      )
    }

    const purchase = await resolvePointsPurchaseFromRequest(request, body)
    const totalCents = Math.round(purchase.amountChf * 100)
    if (totalCents < 50) {
      return NextResponse.json(
        { error: "Mindestbetrag für Stripe Checkout ist 0.50 CHF." },
        { status: 400 }
      )
    }

    const origin = getSiteOrigin(request)
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: purchase.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "chf",
            unit_amount: totalCents,
            product_data: {
              name: "DripForge Treuepunkte",
              description: purchase.label,
            },
          },
        },
      ],
      metadata: {
        purpose: "points-purchase",
        purchaseId: purchase.purchaseId,
        userId: purchase.email,
        points: String(purchase.points),
        amountChf: purchase.amountChf.toFixed(2),
      },
      success_url: `${origin}/konto/punkte?purchase_success=1`,
      cancel_url: `${origin}/konto/punkte?canceled=1`,
    })

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe Checkout konnte nicht erstellt werden." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      purchaseId: purchase.purchaseId,
      points: purchase.points,
    })
  } catch (error) {
    console.error("Punkte-Checkout (Stripe): Fehler.", error)
    const message =
      error instanceof Error ? error.message : "Checkout konnte nicht gestartet werden."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
