import { NextResponse } from "next/server"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import {
  isPaymentMethodEnabled,
  type PaymentMethodId,
} from "@/lib/dripforge/checkout-config"
import type { OrderPayload } from "@/lib/dripforge/submit-order"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import {
  allocateFriendlyOrderId,
  fulfillPaidShopOrder,
  processOrderPayload,
} from "@/lib/shop/order-processing"
import { claimInboundOrderEmailSend } from "@/lib/email/claim-inbound-emails"
import { queueOrderEmails } from "@/lib/email/send-order-emails"
import { getSettings } from "@/lib/admin/db"
import {
  buildCheckoutDiscounts,
  buildCheckoutLineItems,
  sumLineItemsCents,
} from "@/lib/stripe/build-checkout-line-items"
import {
  assertStripeCheckoutUrls,
  getStripeCheckoutUrls,
} from "@/lib/stripe/checkout-urls"
import {
  formatStripeError,
  getStripe,
  getStripeEnvDiagnostics,
  getStripePublishableKey,
  isStripeConfigured,
} from "@/lib/stripe/client"
import { CosmosDatabaseError } from "@/lib/admin/storage-bridge"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const diagnostics = getStripeEnvDiagnostics()
  // Runtime-Key (auch STRIPE_PUBLISHABLE_KEY) — nicht nur Build-Zeit NEXT_PUBLIC_
  return NextResponse.json({
    configured: diagnostics.configured,
    publishableKey: getStripePublishableKey() || null,
    diagnostics,
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
    try {
      await warmCosmosInfrastructure()
    } catch (warmError) {
      console.warn(
        "Shop Checkout: Cosmos-Warmup fehlgeschlagen — versuche Bestellung trotzdem.",
        warmError
      )
    }

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

    const settings = await getSettings()
    if (
      !isPaymentMethodEnabled(
        payload.paymentMethod as PaymentMethodId,
        settings.checkout
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Diese Zahlungsart ist im Admin deaktiviert und kann nicht verwendet werden.",
          success: false,
        },
        { status: 403 }
      )
    }

    const sessionEmail = await getSessionEmailFromRequest()
    const billingEmail = normalizeCustomerEmail(payload.billing.email)
    // Eingeloggtes Konto hat Vorrang — unabhängig von der Formular-E-Mail
    const userId = sessionEmail || billingEmail

    const orderId = await allocateFriendlyOrderId()
    const { order } = await processOrderPayload(payload, {
      orderId,
      paymentConfirmed: false,
      enforceGatewayMinForPoints: true,
      sessionEmail,
      skipInboundEmails: true,
    })

    let boundOrder = order
    try {
      const { bindOrderToCustomer } = await import("@/lib/shop/bind-order-to-account")
      const bound = await bindOrderToCustomer(order, {
        sessionEmail,
        saveAddressToAccount: payload.saveAddressToAccount !== false,
      })
      boundOrder = bound.order
    } catch (bindError) {
      console.error(
        `Shop Checkout: Kundenbindung fehlgeschlagen (${orderId}) — Checkout läuft weiter.`,
        bindError
      )
    }

    const totalCents = Math.round(boundOrder.totals.total * 100)
    const { successUrl, cancelUrl } = getStripeCheckoutUrls()
    try {
      assertStripeCheckoutUrls(successUrl, cancelUrl)
    } catch (urlError) {
      console.error("Stripe Checkout Error:", urlError)
      return NextResponse.json(
        {
          error:
            urlError instanceof Error
              ? urlError.message
              : "Ungültige success_url/cancel_url.",
          success: false,
        },
        { status: 500 }
      )
    }

    if (totalCents < 50) {
      try {
        await fulfillPaidShopOrder(orderId, {
          userId,
          totalChf: boundOrder.totals.total,
          saveAddressToAccount: false,
          skipInboundEmails: true,
        })
        const claimed = await claimInboundOrderEmailSend(orderId)
        if (claimed) {
          const settings = await getSettings()
          queueOrderEmails(boundOrder, settings)
        }
      } catch (fulfillError) {
        console.error(
          `Shop Checkout: Points-only Fulfillment fehlgeschlagen (${orderId}).`,
          fulfillError
        )
      }
      return NextResponse.json({
        success: true,
        configured: true,
        orderId,
        pointsOnly: true,
        url: successUrl.replace("?session_id={CHECKOUT_SESSION_ID}", ""),
      })
    }

    const stripe = getStripe()
    const lineItems = buildCheckoutLineItems(boundOrder)
    if (lineItems.length === 0) {
      console.error("Stripe Checkout Error:", "Keine gültigen line_items (alle Preise 0/ungültig).")
      return NextResponse.json(
        {
          error:
            "Checkout konnte nicht gestartet werden: keine gültigen Positionen mit Preis.",
          success: false,
        },
        { status: 400 }
      )
    }

    const lineTotalCents = sumLineItemsCents(lineItems)
    const discounts = await buildCheckoutDiscounts(stripe, lineTotalCents, totalCents)

    // Nur explizit angeforderte Methoden — keine Test-Price-IDs, nur price_data
    const paymentMethodTypes: Array<"card" | "twint"> =
      payload.paymentMethod === "twint"
        ? ["twint"]
        : ["card"]

    console.info("[Stripe Checkout] Session erstellen", {
      orderId,
      paymentMethod: payload.paymentMethod,
      payment_method_types: paymentMethodTypes,
      totalCents,
      lineItemCount: lineItems.length,
      lineTotalCents,
      successUrl,
      cancelUrl,
      secretKeyMode: getStripeEnvDiagnostics().secretKeyMode,
    })

    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: paymentMethodTypes,
        customer_email: billingEmail,
        line_items: lineItems,
        ...(discounts ? { discounts } : {}),
        metadata: {
          purpose: "shop-order",
          orderId,
          userId,
          customerEmail: billingEmail,
          accountEmail: userId,
          totalChf: boundOrder.totals.total.toFixed(2),
          pointsRedeemed: String(boundOrder.totals.pointsRedeemed ?? 0),
          paymentMethod: payload.paymentMethod,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      })
    } catch (stripeError) {
      console.error("Stripe Checkout Error:", stripeError)
      const formatted = formatStripeError(stripeError)
      console.error("[Stripe Checkout] sessions.create fehlgeschlagen.", {
        orderId,
        payment_method_types: paymentMethodTypes,
        code: formatted.code,
        type: formatted.type,
        message: formatted.message,
        successUrl,
        cancelUrl,
      })
      return NextResponse.json(
        {
          error: formatted.message,
          stripeCode: formatted.code ?? null,
          stripeType: formatted.type ?? null,
          payment_method_types: paymentMethodTypes,
          success: false,
        },
        { status: 502 }
      )
    }

    if (!session.url) {
      console.error("Stripe Checkout Error:", "Session ohne url", {
        sessionId: session.id,
      })
      return NextResponse.json(
        { error: "Stripe Checkout konnte nicht erstellt werden (keine Redirect-URL).", success: false },
        { status: 500 }
      )
    }

    try {
      const { saveOrder } = await import("@/lib/admin/db")
      await saveOrder({
        ...boundOrder,
        stripeSessionId: session.id,
      })
    } catch (sessionSaveError) {
      // Bestellung existiert bereits — Stripe-Session-ID optional nachtragen
      console.error(
        `Shop Checkout: Stripe-Session-ID konnte nicht gespeichert werden (${orderId}).`,
        sessionSaveError
      )
    }

    return NextResponse.json({
      success: true,
      configured: true,
      url: session.url,
      sessionId: session.id,
      orderId,
    })
  } catch (error) {
    console.error("Stripe Checkout Error:", error)
    console.error("Fehler beim Speichern der Bestellung:", error)
    console.error("Shop Checkout: Erstellung fehlgeschlagen.", error)
    const stripeFormatted = formatStripeError(error)
    const message =
      error instanceof CosmosDatabaseError
        ? "Bestellung konnte nicht in der Datenbank gespeichert werden. Bitte erneut versuchen."
        : stripeFormatted.message ||
          (error instanceof Error
            ? error.message
            : "Checkout konnte nicht gestartet werden.")
    return NextResponse.json(
      {
        error: message,
        stripeCode: stripeFormatted.code ?? null,
        stripeType: stripeFormatted.type ?? null,
        success: false,
      },
      { status: 500 }
    )
  }
}
