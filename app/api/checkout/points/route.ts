import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { normalizeEnableRewardPointsSystem } from "@/lib/dripforge/reward-points-settings"
import {
  resolvePointsPurchaseFromRequest,
  type PointsPurchaseRequest,
} from "@/lib/shop/points-purchase"
import { getSiteOrigin, getStripe, isStripeConfigured } from "@/lib/stripe/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Treuepunkte-Kauf via Stripe Checkout (Karte und/oder TWINT).
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe ist noch nicht konfiguriert." },
      { status: 503 }
    )
  }

  try {
    await warmCosmosInfrastructure()

    const settings = await getSettings()
    if (!normalizeEnableRewardPointsSystem(settings.enableRewardPointsSystem)) {
      return NextResponse.json(
        { error: "Treuepunkte-System ist derzeit deaktiviert." },
        { status: 403 }
      )
    }

    const body = (await request.json()) as PointsPurchaseRequest
    const method = body.paymentMethod === "twint" ? "twint" : "card"

    const purchase = await resolvePointsPurchaseFromRequest(request, {
      ...body,
      paymentMethod: method,
    })
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
      payment_method_types: method === "twint" ? ["twint"] : ["card", "twint"],
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
        paymentMethod: method,
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
