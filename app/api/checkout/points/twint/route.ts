import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { normalizeEnableRewardPointsSystem } from "@/lib/dripforge/reward-points-settings"
import { getAccountByEmail } from "@/lib/konto/account-db"
import { createTwintGateway, isPayrexxConfigured } from "@/lib/payrexx/client"
import {
  resolvePointsPurchaseFromRequest,
  fulfillPointsPurchase,
  type PointsPurchaseRequest,
} from "@/lib/shop/points-purchase"
import { savePendingPointsPurchase } from "@/lib/shop/points-purchase-store"
import { getSiteOrigin } from "@/lib/stripe/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!isPayrexxConfigured()) {
    return NextResponse.json(
      { error: "Payrexx/TWINT ist noch nicht konfiguriert." },
      { status: 503 }
    )
  }

  try {
    await warmCosmosInfrastructure()

    const settings = await getSettings()
    if (!normalizeEnableRewardPointsSystem(settings.enableRewardPointsSystem)) {
      return NextResponse.json(
        { error: "Treuepunkte-System ist deaktiviert." },
        { status: 403 }
      )
    }

    const body = (await request.json()) as PointsPurchaseRequest
    if (body.paymentMethod !== "twint") {
      return NextResponse.json(
        { error: "Diese Route ist nur für TWINT vorgesehen." },
        { status: 400 }
      )
    }

    const purchase = await resolvePointsPurchaseFromRequest(request, body)
    const account = await getAccountByEmail(purchase.email)
    if (!account) {
      return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 })
    }

    const totalCents = Math.round(purchase.amountChf * 100)
    if (totalCents < 50) {
      return NextResponse.json(
        { error: "Mindestbetrag für TWINT ist 0.50 CHF." },
        { status: 400 }
      )
    }

    const origin = getSiteOrigin(request)
    const gateway = await createTwintGateway({
      amountCents: totalCents,
      orderId: purchase.purchaseId,
      purpose: `DripForge Punkte: ${purchase.label}`,
      successRedirectUrl: `${origin}/konto/punkte?purchase_success=1`,
      failedRedirectUrl: `${origin}/konto/punkte?payment_failed=1`,
      cancelRedirectUrl: `${origin}/konto/punkte?canceled=1`,
      customer: {
        firstName: account.firstName,
        lastName: account.lastName,
        email: purchase.email,
        phone: account.phone ?? "",
        street: account.street ?? "",
        zip: account.zip ?? "",
        city: account.city ?? "",
        country: "Schweiz",
      },
    })

    await savePendingPointsPurchase({
      purchaseId: purchase.purchaseId,
      email: purchase.email,
      points: purchase.points,
      amountChf: purchase.amountChf,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json({
      url: gateway.link,
      gatewayHash: gateway.hash,
      purchaseId: purchase.purchaseId,
      points: purchase.points,
    })
  } catch (error) {
    console.error("Punkte-Checkout (TWINT): Fehler.", error)
    const message =
      error instanceof Error ? error.message : "TWINT-Checkout konnte nicht gestartet werden."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
