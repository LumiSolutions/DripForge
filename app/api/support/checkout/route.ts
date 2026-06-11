import { NextResponse } from "next/server"
import {
  getSiteOrigin,
  getStripe,
  isStripeConfigured,
} from "@/lib/stripe/client"
import {
  normalizeSupporterAmountChf,
  normalizeSupporterEmail,
  normalizeSupporterName,
} from "@/lib/support/types"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

type CheckoutBody = {
  amountChf?: number
  name?: string
  email?: string
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe ist noch nicht konfiguriert. Bitte STRIPE_SECRET_KEY in der Umgebung hinterlegen.",
        configured: false,
      },
      { status: 503 }
    )
  }

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as CheckoutBody
    const amountChf = normalizeSupporterAmountChf(body.amountChf)
    const name = normalizeSupporterName(body.name)
    const email = normalizeSupporterEmail(body.email)

    if (!amountChf) {
      return NextResponse.json(
        { error: "Bitte einen Betrag zwischen 5 und 10'000 CHF wählen." },
        { status: 400 }
      )
    }
    if (!name) {
      return NextResponse.json(
        { error: "Bitte deinen Namen angeben." },
        { status: 400 }
      )
    }
    if (!email) {
      return NextResponse.json(
        { error: "Bitte eine gültige E-Mail-Adresse angeben." },
        { status: 400 }
      )
    }

    const origin = getSiteOrigin(request)
    const stripe = getStripe()
    const amountCents = Math.round(amountChf * 100)

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "twint"],
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "chf",
            unit_amount: amountCents,
            product_data: {
              name: "DripForge — Support our Journey",
              description: `Unterstützung für die DripForge-Manufaktur (${amountChf.toFixed(2)} CHF)`,
            },
          },
        },
      ],
      metadata: {
        supporterName: name,
        supporterEmail: email,
        amountChf: amountChf.toFixed(2),
        purpose: "support-journey",
      },
      success_url: `${origin}/support?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/support?canceled=1`,
    })

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe Checkout konnte nicht erstellt werden." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      configured: true,
      url: session.url,
      sessionId: session.id,
    })
  } catch (error) {
    console.error("Support Checkout: Erstellung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Checkout konnte nicht gestartet werden." },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ configured: isStripeConfigured() })
}
