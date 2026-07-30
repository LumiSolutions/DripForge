import { normalizeCustomerEmail } from "@/lib/admin/customers"
import {
  chfToPurchasedLoyaltyPoints,
  createPointsPurchaseId,
  grantLoyaltyPoints,
  LOYALTY_POINT_PACKAGES,
  normalizeLoyaltyPoints,
} from "@/lib/konto/loyalty-points"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"

export type PointsPurchaseRequest = {
  packageId?: string
  customAmountChf?: number
  paymentMethod: "card" | "twint"
}

export type ResolvedPointsPurchase = {
  purchaseId: string
  email: string
  points: number
  amountChf: number
  label: string
}

export type CheckoutPointsPurchaseRequest = {
  packageId?: string
  customAmountChf?: number
}

export function resolveCheckoutPointsPurchase(
  body: CheckoutPointsPurchaseRequest
): Pick<ResolvedPointsPurchase, "points" | "amountChf" | "label"> {
  let points = 0
  let amountChf = 0
  let label = ""

  const packageId = body.packageId?.trim()
  if (packageId) {
    const pkg = LOYALTY_POINT_PACKAGES.find((entry) => entry.id === packageId)
    if (!pkg) {
      throw new Error("Punktepaket nicht gefunden.")
    }
    points = pkg.points
    amountChf = pkg.priceChf
    label = pkg.label
  } else if (body.customAmountChf != null) {
    amountChf = Math.round(Number(body.customAmountChf) * 100) / 100
    if (!Number.isFinite(amountChf) || amountChf < 1) {
      throw new Error("Mindestbetrag für individuelle Punkte: 1.00 CHF.")
    }
    if (amountChf > 500) {
      throw new Error("Maximal 500.00 CHF pro Punktekauf.")
    }
    points = chfToPurchasedLoyaltyPoints(amountChf)
    label = `${points} Punkte`
  } else {
    throw new Error("Kein Punktepaket ausgewählt.")
  }

  if (points <= 0) {
    throw new Error("Ungültiger Punktebetrag.")
  }

  return {
    points: normalizeLoyaltyPoints(points),
    amountChf,
    label,
  }
}

export function resolvePointsPurchase(
  body: PointsPurchaseRequest,
  sessionEmail: string | null
): ResolvedPointsPurchase {
  const email = normalizeCustomerEmail(sessionEmail ?? "")
  if (!email) {
    throw new Error("Bitte melde dich an, um Punkte zu kaufen.")
  }

  if (body.paymentMethod !== "card" && body.paymentMethod !== "twint") {
    throw new Error("Ungültige Zahlungsart.")
  }

  let points = 0
  let amountChf = 0
  let label = ""

  const packageId = body.packageId?.trim()
  if (packageId) {
    const pkg = LOYALTY_POINT_PACKAGES.find((entry) => entry.id === packageId)
    if (!pkg) {
      throw new Error("Punktepaket nicht gefunden.")
    }
    points = pkg.points
    amountChf = pkg.priceChf
    label = pkg.label
  } else {
    amountChf = Math.round(Number(body.customAmountChf) * 100) / 100
    if (!Number.isFinite(amountChf) || amountChf < 1) {
      throw new Error("Mindestbetrag für individuelle Punkte: 1.00 CHF.")
    }
    if (amountChf > 500) {
      throw new Error("Maximal 500.00 CHF pro Punktekauf.")
    }
    points = chfToPurchasedLoyaltyPoints(amountChf)
    label = `${points} Punkte`
  }

  if (points <= 0) {
    throw new Error("Ungültiger Punktebetrag.")
  }

  return {
    purchaseId: createPointsPurchaseId(),
    email,
    points: normalizeLoyaltyPoints(points),
    amountChf,
    label,
  }
}

export async function fulfillPointsPurchase(
  purchaseId: string,
  email: string,
  points: number,
  paymentRef: string
): Promise<{ granted: boolean; newBalance: number }> {
  const { getSettings } = await import("@/lib/admin/db")
  const { buildRewardPointsPublicSettings } = await import(
    "@/lib/dripforge/reward-points-settings"
  )
  const rewardCfg = buildRewardPointsPublicSettings(await getSettings())
  const result = await grantLoyaltyPoints(
    email,
    points,
    `purchase:${paymentRef}`,
    "purchase",
    `Punktekauf ${purchaseId}`,
    { expiryMonths: rewardCfg.loyaltyPointsExpiryMonths }
  )
  return { granted: result.success, newBalance: result.newBalance }
}

export async function resolvePointsPurchaseFromRequest(
  request: Request,
  body: PointsPurchaseRequest
): Promise<ResolvedPointsPurchase> {
  const sessionEmail = await getSessionEmailFromRequest()
  return resolvePointsPurchase(body, sessionEmail)
}
