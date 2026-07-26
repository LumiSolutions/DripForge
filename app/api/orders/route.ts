import { NextResponse } from "next/server"
import { isCosmosConfigured } from "@/lib/admin/cosmos-store"
import { getAccountByEmail } from "@/lib/konto/account-db"
import { grantAiCreditsForPaidOrder } from "@/lib/konto/ai-credits"
import {
  grantLoyaltyPointsForPaidOrder,
  redeemLoyaltyPointsForOrder,
  normalizeLoyaltyPoints,
  grantLoyaltyPoints,
  calculateLoyaltyEarnBaseChf,
} from "@/lib/konto/loyalty-points"
import type { OrderPayload } from "@/lib/dripforge/submit-order"
import { processOrderPayload } from "@/lib/shop/order-processing"
import { upsertCustomerFromOrder } from "@/lib/admin/db"
import { applyInventoryReservationForOrder } from "@/lib/admin/order-inventory-hook"
import { buildRewardPointsPublicSettings } from "@/lib/dripforge/reward-points-settings"

export async function POST(request: Request) {
  let orderId = ""

  try {
    const payload = (await request.json()) as OrderPayload

    orderId = `pending`
    console.info(
      `Bestell-API: Verarbeitung gestartet, Speicher: ${
        isCosmosConfigured() ? "Cosmos DB" : "Dateisystem"
      }.`
    )

    const { order, itemResults, settings } = await processOrderPayload(payload, {
      paymentConfirmed: true,
      enforceGatewayMinForPoints: false,
    })
    orderId = order.orderId

    console.info(`Bestell-API: Bestellung gespeichert (${orderId}).`)

    const customer = await upsertCustomerFromOrder(order)
    console.info(
      `Bestell-API: Kunde verknüpft (${customer.kundennummer}, ${orderId}).`
    )

    const portalAccount = await getAccountByEmail(order.billing.email)
    let aiCreditsGranted = 0
    let loyaltyPointsGranted = 0
    const rewardCfg = buildRewardPointsPublicSettings(settings)
    const rewardPointsEnabled = rewardCfg.enableRewardPointsSystem

    const pointsRedeemed = normalizeLoyaltyPoints(order.totals.pointsRedeemed ?? 0)
    if (rewardPointsEnabled && pointsRedeemed > 0 && portalAccount) {
      await redeemLoyaltyPointsForOrder(
        order.billing.email,
        pointsRedeemed,
        order.orderId,
        { expiryMonths: rewardCfg.loyaltyPointsExpiryMonths }
      )
    }

    const pointsPurchased = normalizeLoyaltyPoints(order.totals.pointsPurchased ?? 0)
    if (rewardPointsEnabled && pointsPurchased > 0 && portalAccount) {
      await grantLoyaltyPoints(
        order.billing.email,
        pointsPurchased,
        `purchase:${order.orderId}`,
        "purchase",
        `Punktekauf mit Bestellung ${order.orderId}`,
        { expiryMonths: rewardCfg.loyaltyPointsExpiryMonths }
      )
    }

    if (portalAccount) {
      const grant = await grantAiCreditsForPaidOrder(
        order.billing.email,
        order.totals.total,
        orderId
      )
      if (grant.granted) {
        aiCreditsGranted = grant.credits
        console.info(
          `Bestell-API: +${grant.credits} KI-Credits für ${order.billing.email} (${orderId}).`
        )
      }

      if (rewardPointsEnabled) {
        const earnBase = calculateLoyaltyEarnBaseChf(order.totals)
        const loyaltyGrant = await grantLoyaltyPointsForPaidOrder(
          order.billing.email,
          earnBase,
          orderId,
          {
            earnPercent: rewardCfg.loyaltyEarnPercent,
            expiryMonths: rewardCfg.loyaltyPointsExpiryMonths,
          }
        )
        if (loyaltyGrant.success) {
          loyaltyPointsGranted = loyaltyGrant.points
        }
      }
    }

    const orderWithCustomer = {
      ...order,
      kundennummer: customer.kundennummer,
    }

    await applyInventoryReservationForOrder(orderWithCustomer)

    return NextResponse.json({
      orderId,
      kundennummer: customer.kundennummer,
      aiCreditsGranted,
      loyaltyPointsGranted,
      items: itemResults,
      message: "Bestellung erfolgreich übermittelt.",
    })
  } catch (error) {
    console.error(
      `Bestell-API: Verarbeitung fehlgeschlagen${orderId !== "pending" && orderId ? ` (${orderId})` : ""}.`,
      error
    )
    const message =
      error instanceof Error ? error.message : "Interner Serverfehler bei der Bestellung."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
