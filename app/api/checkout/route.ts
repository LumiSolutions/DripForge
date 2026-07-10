import { NextResponse } from "next/server"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import type { OrderPayload } from "@/lib/dripforge/submit-order"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { createOrderId, fulfillPaidShopOrder, processOrderPayload } from "@/lib/shop/order-processing"
import {
  buildCheckoutDiscounts,
  buildCheckoutLineItems,
  sumLineItemsCents,
} from "@/lib/stripe/build-checkout-line-items"
import { getStripeCheckoutUrls } from "@/lib/stripe/checkout-urls"
import { getStripe, isStripeConfigured } from "@/lib/stripe/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    configured: isStripeConfigured(),
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null,
  })
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

    const payload = (await request.json()) as OrderPayload
    if (!payload.items?.length || !payload.billing?.email) {
      return NextResponse.json(
        { error: "Unvollständige Bestelldaten." },
        { status: 400 }
      )
    }

    if (payload.paymentMethod === "invoice") {
      return NextResponse.json(
        { error: "Rechnungskauf nutzt /api/orders, nicht Stripe Checkout." },
        { status: 400 }
      )
    }

    const sessionEmail = await getSessionEmailFromRequest()
    const billingEmail = normalizeCustomerEmail(payload.billing.email)
    const userId =
      sessionEmail && sessionEmail === billingEmail ? sessionEmail : billingEmail

    const orderId = createOrderId()
    const { order } = await processOrderPayload(payload, {
      orderId,
      paymentConfirmed: false,
      enforceGatewayMinForPoints: true,
    })

    const totalCents = Math.round(order.totals.total * 100)
    const { successUrl, cancelUrl } = getStripeCheckoutUrls()

    if (totalCents < 50) {
      await fulfillPaidShopOrder(orderId, {
        userId,
        totalChf: order.totals.total,
      })
      return NextResponse.json({
        configured: true,
        orderId,
        pointsOnly: true,
        url: successUrl.replace("?session_id={CHECKOUT_SESSION_ID}", ""),
      })
    }

    const stripe = getStripe()
    const lineItems = buildCheckoutLineItems(order)
    const lineTotalCents = sumLineItemsCents(lineItems)
    const discounts = await buildCheckoutDiscounts(stripe, lineTotalCents, totalCents)

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "twint"],
      customer_email: billingEmail,
      line_items: lineItems,
      ...(discounts ? { discounts } : {}),
      metadata: {
        purpose: "shop-order",
        orderId,
        userId,
        customerEmail: billingEmail,
        totalChf: order.totals.total.toFixed(2),
        pointsRedeemed: String(order.totals.pointsRedeemed ?? 0),
        paymentMethod: payload.paymentMethod,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe Checkout konnte nicht erstellt werden." },
        { status: 500 }
      )
    }

    const { saveOrder } = await import("@/lib/admin/db")
    await saveOrder({
      ...order,
      stripeSessionId: session.id,
    })

    return NextResponse.json({
      configured: true,
      url: session.url,
      sessionId: session.id,
      orderId,
    })
  } catch (error) {
    console.error("Shop Checkout: Erstellung fehlgeschlagen.", error)
    const message =
      error instanceof Error ? error.message : "Checkout konnte nicht gestartet werden."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
