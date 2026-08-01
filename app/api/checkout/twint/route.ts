import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getOrderById } from "@/lib/admin/db"
import { applyInventoryReservationForOrder } from "@/lib/admin/order-inventory-hook"
import { CosmosDatabaseError } from "@/lib/admin/storage-bridge"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import type { OrderPayload } from "@/lib/dripforge/submit-order"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { bindOrderToCustomer } from "@/lib/shop/bind-order-to-account"
import { processOrderPayload } from "@/lib/shop/order-processing"
import { claimInboundOrderEmailSend } from "@/lib/email/claim-inbound-emails"
import { queueOrderEmails } from "@/lib/email/send-order-emails"
import {
  buildTwintPaymentUrl,
  formatTwintAmount,
  getTwintPaymentLinkBase,
  isTwintPaymentLinkConfigured,
} from "@/lib/twint/payment-link"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * TWINT-Zahlungslink-Checkout.
 * GET: Status / Link für bestehende Bestellung
 * POST: Bestellung anlegen (ausstehend), Mails senden, Zahlungslink zurückgeben
 */
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("orderId")?.trim()

  if (!orderId) {
    return NextResponse.json({
      configured: isTwintPaymentLinkConfigured(),
      provider: "twint-payment-link",
    })
  }

  if (!isTwintPaymentLinkConfigured()) {
    return NextResponse.json(
      { error: "TWINT-Zahlungslink ist nicht konfiguriert." },
      { status: 503 }
    )
  }

  const order = await getOrderById(orderId)
  if (!order) {
    return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 })
  }

  if (order.paymentMethod !== "twint") {
    return NextResponse.json(
      { error: "Bestellung ist keine TWINT-Bestellung." },
      { status: 400 }
    )
  }

  const amountChf = order.totals.total
  const twintPaymentUrl = buildTwintPaymentUrl({
    orderId: order.orderId,
    amountChf,
  })

  return NextResponse.json({
    configured: true,
    orderId: order.orderId,
    amountChf,
    amountFormatted: formatTwintAmount(amountChf),
    paymentConfirmed: Boolean(order.paymentConfirmed),
    twintPaymentUrl,
  })
}

export async function POST(request: Request) {
  if (!isTwintPaymentLinkConfigured()) {
    return NextResponse.json(
      {
        error:
          "TWINT-Zahlungslink ist nicht konfiguriert. Bitte TWINT_PAYMENT_LINK setzen.",
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
        "TWINT-Checkout: Cosmos-Warmup fehlgeschlagen — versuche Bestellung trotzdem.",
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

    if (payload.paymentMethod !== "twint") {
      return NextResponse.json(
        { error: "Diese Route ist nur für TWINT-Zahlungen." },
        { status: 400 }
      )
    }

    const settings = await getSettings()
    if (!isPaymentMethodEnabled("twint", settings.checkout)) {
      return NextResponse.json(
        {
          error:
            "TWINT ist im Admin deaktiviert und kann nicht verwendet werden.",
          success: false,
        },
        { status: 403 }
      )
    }

    const sessionEmail = await getSessionEmailFromRequest()

    // Pending: wartet auf TWINT-Zahlung — keine Credits/Punkte bis Zahlung bestätigt
    const { order, itemResults, settings } = await processOrderPayload(
      { ...payload, paymentMethod: "twint" },
      {
        paymentConfirmed: false,
        enforceGatewayMinForPoints: false,
        sessionEmail,
        skipInboundEmails: true,
      }
    )

    // E-Mails nicht-blockierend — Response sofort (Azure SWA Timeout-Schutz)
    try {
      const claimed = await claimInboundOrderEmailSend(order.orderId)
      if (claimed) {
        console.log("Sending order emails for order:", order.orderId)
        queueOrderEmails(order, settings)
      } else {
        console.info(
          `TWINT: Eingangsmails bereits geclaimed (${order.orderId}), überspringe.`
        )
      }
    } catch (error) {
      console.error("Bestell-Mail Fehler:", error)
      console.error("CRITICAL_SMTP_ERROR:", error)
    }

    let orderWithCustomer = order
    let kundennummer: string | undefined
    let accountEmail =
      sessionEmail || order.billing.email.trim().toLowerCase()

    try {
      const bound = await bindOrderToCustomer(order, {
        sessionEmail,
        saveAddressToAccount: payload.saveAddressToAccount !== false,
      })
      orderWithCustomer = bound.order
      kundennummer = bound.customer.kundennummer
      accountEmail = bound.accountEmail
    } catch (bindError) {
      console.error(
        `TWINT-Checkout: Kundenbindung fehlgeschlagen (${order.orderId}) — Bestellung bleibt erhalten.`,
        bindError
      )
    }

    try {
      await applyInventoryReservationForOrder(orderWithCustomer)
    } catch (inventoryError) {
      console.error(
        `TWINT-Checkout: Lagerreservation fehlgeschlagen (${order.orderId}).`,
        inventoryError
      )
    }

    const amountChf = orderWithCustomer.totals.total
    const twintPaymentUrl = buildTwintPaymentUrl({
      orderId: orderWithCustomer.orderId,
      amountChf,
    })

    console.info(
      `TWINT-Checkout: Bestellung ${orderWithCustomer.orderId} angelegt (ausstehend), Link bereit.`
    )

    return NextResponse.json({
      success: true,
      configured: true,
      orderId: orderWithCustomer.orderId,
      kundennummer,
      accountEmail,
      amountChf,
      amountFormatted: formatTwintAmount(amountChf),
      twintPaymentUrl,
      twintPaymentLinkBase: getTwintPaymentLinkBase(),
      items: itemResults,
      message: "Bestellung gespeichert — bitte per TWINT bezahlen.",
      successPath: `/bestellung/erfolg?order_id=${encodeURIComponent(orderWithCustomer.orderId)}&method=twint&amount=${encodeURIComponent(formatTwintAmount(amountChf))}`,
    })
  } catch (error) {
    console.error("Fehler beim Speichern der Bestellung:", error)
    console.error("TWINT-Checkout: Erstellung fehlgeschlagen.", error)
    const message =
      error instanceof CosmosDatabaseError
        ? "Bestellung konnte nicht in der Datenbank gespeichert werden. Bitte erneut versuchen."
        : error instanceof Error
          ? error.message
          : "TWINT-Checkout konnte nicht gestartet werden."
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}
