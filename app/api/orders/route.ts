import { NextResponse } from "next/server"
import { isCosmosConfigured } from "@/lib/admin/cosmos-store"
import { getSettings } from "@/lib/admin/db"
import { getAccountByEmail } from "@/lib/konto/account-db"
import { grantAiCreditsForPaidOrder } from "@/lib/konto/ai-credits"
import {
  grantLoyaltyPointsForPaidOrder,
  redeemLoyaltyPointsForOrder,
  normalizeLoyaltyPoints,
  grantLoyaltyPoints,
  calculateLoyaltyEarnBaseChf,
} from "@/lib/konto/loyalty-points"
import {
  isPaymentMethodAllowedForCheckout,
  type PaymentMethodId,
} from "@/lib/dripforge/checkout-config"
import type { OrderPayload } from "@/lib/dripforge/submit-order"
import { processOrderPayload } from "@/lib/shop/order-processing"
import { claimInboundOrderEmailSend } from "@/lib/email/claim-inbound-emails"
import { queueOrderEmails } from "@/lib/email/send-order-emails"
import { bindOrderToCustomer } from "@/lib/shop/bind-order-to-account"
import { applyInventoryReservationForOrder } from "@/lib/admin/order-inventory-hook"
import { buildRewardPointsPublicSettings } from "@/lib/dripforge/reward-points-settings"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { resolveCustomerCategoryForEmail } from "@/lib/konto/resolve-customer-category"
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

    const checkoutSettings = await getSettings()
    const category = sessionEmail
      ? await resolveCustomerCategoryForEmail(sessionEmail)
      : null
    if (
      !isPaymentMethodAllowedForCheckout(
        payload.paymentMethod as PaymentMethodId,
        checkoutSettings.checkout,
        category?.allowedPaymentMethodIds
      )
    ) {
      console.warn("[Bestell-API] Zahlungsart blockiert.", {
        method: payload.paymentMethod,
        sessionEmail: sessionEmail ?? null,
        categoryId: category?.id ?? null,
      })
      return NextResponse.json(
        {
          error:
            "Diese Zahlungsart ist nicht verfügbar (Admin deaktiviert oder nicht für deine Kundenkategorie freigegeben).",
        },
        { status: 403 }
      )
    }

    orderId = `pending`
    console.info(
      `Bestell-API: Verarbeitung gestartet, Speicher: ${
        isCosmosConfigured() ? "Cosmos DB" : "Dateisystem"
      }, Session: ${sessionEmail ?? "Gast"}.`
    )

    // 1) Bestellung zuerst persistent speichern (ohne Mails im processOrderPayload)
    // Kauf auf Rechnung: Zahlung gilt als AUSSTEHEND — zählt erst nach manueller
    // Bestätigung im Admin zum Umsatz (Produktionsstatus "Bestellungseingang").
    const { order, itemResults, settings } = await processOrderPayload(payload, {
      paymentConfirmed: false,
      enforceGatewayMinForPoints: false,
      sessionEmail,
      skipInboundEmails: true,
    })
    orderId = order.orderId
    console.info(`Bestell-API: Bestellung gespeichert (${orderId}).`)

    // 2) E-Mails nicht-blockierend — Response sofort, SMTP im Hintergrund (Azure SWA)
    try {
      const claimed = await claimInboundOrderEmailSend(order.orderId)
      if (claimed) {
        console.log("Sending order emails for order:", order.orderId)
        queueOrderEmails(order, settings)
      } else {
        console.info(
          `Bestell-API: Eingangsmails bereits geclaimed (${order.orderId}), überspringe.`
        )
      }
    } catch (error) {
      console.error("Bestell-Mail Fehler:", error)
      console.error("CRITICAL_SMTP_ERROR:", error)
    }

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
    console.error("Fehler beim Speichern der Bestellung:", error)
    console.error(
      `Bestell-API: Verarbeitung fehlgeschlagen${orderId !== "pending" && orderId ? ` (${orderId})` : ""}.`,
      error instanceof Error
        ? { message: error.message, name: error.name, cause: error.cause }
        : error
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
