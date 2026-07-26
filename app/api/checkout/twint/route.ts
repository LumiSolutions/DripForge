import { NextResponse } from "next/server"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import type { OrderPayload } from "@/lib/dripforge/submit-order"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import {
  createTwintGateway,
  isPayrexxConfigured,
} from "@/lib/payrexx/client"
import { createOrderId, fulfillPaidShopOrder, processOrderPayload } from "@/lib/shop/order-processing"
import { getSiteOrigin } from "@/lib/stripe/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    configured: isPayrexxConfigured(),
  })
}

export async function POST(request: Request) {
  if (!isPayrexxConfigured()) {
    return NextResponse.json(
      {
        error:
          "Payrexx/TWINT ist noch nicht konfiguriert. Bitte PAYREXX_INSTANCE_NAME und PAYREXX_API_SECRET in der Umgebung hinterlegen.",
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

    if (payload.paymentMethod !== "twint") {
      return NextResponse.json(
        { error: "Diese Route ist nur für TWINT-Zahlungen vorgesehen." },
        { status: 400 }
      )
    }

    const sessionEmail = await getSessionEmailFromRequest()
    const billingEmail = normalizeCustomerEmail(payload.billing.email)
    const userId = sessionEmail || billingEmail

    const orderId = createOrderId()
    const { order } = await processOrderPayload(payload, {
      orderId,
      paymentConfirmed: false,
      enforceGatewayMinForPoints: true,
      sessionEmail,
    })

    const { bindOrderToCustomer } = await import("@/lib/shop/bind-order-to-account")
    const { order: boundOrder } = await bindOrderToCustomer(order, {
      sessionEmail,
      saveAddressToAccount: payload.saveAddressToAccount !== false,
    })

    const totalCents = Math.round(boundOrder.totals.total * 100)
    if (totalCents < 50) {
      await fulfillPaidShopOrder(orderId, {
        userId,
        totalChf: boundOrder.totals.total,
        saveAddressToAccount: false,
      })
      return NextResponse.json({
        configured: true,
        orderId,
        pointsOnly: true,
        url: `${getSiteOrigin(request)}/checkout?order_success=1`,
      })
    }

    const origin = getSiteOrigin(request)
    const itemSummary = `${boundOrder.items.length} Artikel — TWINT`

    const gateway = await createTwintGateway({
      amountCents: totalCents,
      orderId,
      purpose: `DripForge Bestellung ${orderId}`,
      successRedirectUrl: `${origin}/checkout?order_success=1`,
      failedRedirectUrl: `${origin}/checkout?payment_failed=1`,
      cancelRedirectUrl: `${origin}/checkout?canceled=1`,
      customer: {
        firstName: payload.billing.firstName,
        lastName: payload.billing.lastName,
        email: billingEmail,
        phone: payload.billing.phone,
        street: payload.billing.street,
        zip: payload.billing.zip,
        city: payload.billing.city,
        country: payload.billing.country,
      },
      vatRate: boundOrder.totals.mwstAktiv ? undefined : 0,
    })

    const { saveOrder } = await import("@/lib/admin/db")
    await saveOrder({
      ...boundOrder,
      accountEmail: userId,
      payrexxGatewayHash: gateway.hash,
    })

    return NextResponse.json({
      configured: true,
      url: gateway.link,
      gatewayHash: gateway.hash,
      orderId,
      purpose: itemSummary,
    })
  } catch (error) {
    console.error("TWINT Checkout: Erstellung fehlgeschlagen.", error)
    const message =
      error instanceof Error
        ? error.message
        : "TWINT-Checkout konnte nicht gestartet werden."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
