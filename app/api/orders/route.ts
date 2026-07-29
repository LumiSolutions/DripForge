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
import {
  processOrderPayload,
  sendInboundOrderEmailsSafe,
} from "@/lib/shop/order-processing"
import { bindOrderToCustomer } from "@/lib/shop/bind-order-to-account"
import { applyInventoryReservationForOrder } from "@/lib/admin/order-inventory-hook"
import { buildRewardPointsPublicSettings } from "@/lib/dripforge/reward-points-settings"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { CosmosDatabaseError } from "@/lib/admin/storage-bridge"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export async function POST(request: Request) {
  let orderId = ""

  try {
    try {
      await warmCosmosInfrastructure()
    } catch (warmError) {
      console.warn(
        "Bestell-API: Cosmos-Warmup fehlgeschlagen — versuche Bestellung trotzdem.",
        warmError
      )
    }

    const payload = (await request.json()) as OrderPayload
    const sessionEmail = await getSessionEmailFromRequest()

    orderId = `pending`
    console.info(
      `Bestell-API: Verarbeitung gestartet, Speicher: ${
        isCosmosConfigured() ? "Cosmos DB" : "Dateisystem"
      }, Session: ${sessionEmail ?? "Gast"}.`
    )

    // 1) Bestellung zuerst persistent speichern (ohne Mails)
    const { order, itemResults, settings } = await processOrderPayload(payload, {
      paymentConfirmed: true,
      enforceGatewayMinForPoints: false,
      sessionEmail,
      skipInboundEmails: true,
    })
    orderId = order.orderId
    console.info(`Bestell-API: Bestellung gespeichert (${orderId}).`)

    // Ab hier: Erfolg zurückgeben — Nebenpfade dürfen den Checkout nicht mehr killen.
    let kundennummer: string | undefined
    let orderWithCustomer = order
    let accountEmail =
      sessionEmail || order.billing.email.trim().toLowerCase()

    try {
      const bound = await bindOrderToCustomer(order, {
        sessionEmail,
        saveAddressToAccount: payload.saveAddressToAccount !== false,
      })
      kundennummer = bound.customer.kundennummer
      accountEmail = bound.accountEmail
      orderWithCustomer = bound.order
      console.info(
        `Bestell-API: Kunde verknüpft (${kundennummer}, ${orderId}, Konto: ${accountEmail}).`
      )
    } catch (bindError) {
      console.error(
        `Bestell-API: Kundenbindung fehlgeschlagen (${orderId}) — Bestellung bleibt erhalten.`,
        bindError
      )
    }

    let aiCreditsGranted = 0
    let loyaltyPointsGranted = 0

    try {
      const portalAccount = await getAccountByEmail(accountEmail)
      const rewardCfg = buildRewardPointsPublicSettings(settings)
      const rewardPointsEnabled = rewardCfg.enableRewardPointsSystem

      const pointsRedeemed = normalizeLoyaltyPoints(
        order.totals.pointsRedeemed ?? 0
      )
      if (rewardPointsEnabled && pointsRedeemed > 0 && portalAccount) {
        await redeemLoyaltyPointsForOrder(
          accountEmail,
          pointsRedeemed,
          order.orderId,
          { expiryMonths: rewardCfg.loyaltyPointsExpiryMonths }
        )
      }

      const pointsPurchased = normalizeLoyaltyPoints(
        order.totals.pointsPurchased ?? 0
      )
      if (rewardPointsEnabled && pointsPurchased > 0 && portalAccount) {
        await grantLoyaltyPoints(
          accountEmail,
          pointsPurchased,
          `purchase:${order.orderId}`,
          "purchase",
          `Punktekauf mit Bestellung ${order.orderId}`,
          { expiryMonths: rewardCfg.loyaltyPointsExpiryMonths }
        )
      }

      if (portalAccount) {
        const grant = await grantAiCreditsForPaidOrder(
          accountEmail,
          order.totals.total,
          orderId
        )
        if (grant.granted) {
          aiCreditsGranted = grant.credits
          console.info(
            `Bestell-API: +${grant.credits} KI-Credits für ${accountEmail} (${orderId}).`
          )
        }

        if (rewardPointsEnabled) {
          const earnBase = calculateLoyaltyEarnBaseChf(order.totals)
          const loyaltyGrant = await grantLoyaltyPointsForPaidOrder(
            accountEmail,
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
    } catch (pointsError) {
      console.error(
        `Bestell-API: Punkte/Credits fehlgeschlagen (${orderId}) — Bestellung bleibt erhalten.`,
        pointsError
      )
    }

    try {
      await applyInventoryReservationForOrder(orderWithCustomer)
    } catch (inventoryError) {
      console.error(
        `Bestell-API: Lagerreservation fehlgeschlagen (${orderId}) — Bestellung bleibt erhalten.`,
        inventoryError
      )
    }

    // E-Mails fire-and-forget — blockieren weder Response noch DB
    void sendInboundOrderEmailsSafe(orderWithCustomer, settings).catch(
      (mailError) => {
        console.error(
          `Bestell-API: E-Mail-Versand fehlgeschlagen (${orderId}) — Bestellung bleibt erhalten.`,
          mailError
        )
      }
    )

    return NextResponse.json({
      success: true,
      orderId,
      kundennummer,
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
      error instanceof CosmosDatabaseError
        ? "Bestellung konnte nicht in der Datenbank gespeichert werden. Bitte erneut versuchen."
        : error instanceof Error
          ? error.message
          : "Interner Serverfehler bei der Bestellung."
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}
