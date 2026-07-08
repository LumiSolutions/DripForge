import { uploadOrderLeitbild } from "@/lib/azure/upload-order-leitbild"
import {
  getOrderById,
  getSettings,
  saveOrder,
  upsertCustomerFromOrder,
} from "@/lib/admin/db"
import { getCouponByCode, incrementCouponRedemption } from "@/lib/admin/coupon-db"
import { validateCouponForCheckout } from "@/lib/admin/coupon-validation"
import { normalizeCouponCode } from "@/lib/admin/coupon-types"
import {
  DEFAULT_PRODUCTION_STATUS,
  getPaymentMethodLabel,
  type AdminSettings,
  type StoredOrder,
  type StoredOrderItem,
} from "@/lib/admin/types"
import { calculateCheckoutTotalsWithCoupon, calculateCheckoutTotalsWithDiscounts } from "@/lib/dripforge/coupon-checkout"
import { getShippingCost } from "@/lib/dripforge/checkout-config"
import type { OrderPayload } from "@/lib/dripforge/submit-order"
import { grantAiCreditsForPaidOrder } from "@/lib/konto/ai-credits"
import { getAccountByEmail } from "@/lib/konto/account-db"
import {
  grantLoyaltyPointsForPaidOrder,
  maxRedeemablePoints,
  normalizeLoyaltyPoints,
  redeemLoyaltyPointsForOrder,
  grantLoyaltyPoints,
  calculateLoyaltyEarnBaseChf,
  LOYALTY_MIN_GATEWAY_PAYMENT_CHF,
} from "@/lib/konto/loyalty-points"
import { orderHasCustomerInbound } from "@/lib/admin/customer-inbound-order"
import { applyInventoryReservationForOrder } from "@/lib/admin/order-inventory-hook"
import { notifyOrderReceived } from "@/lib/email/order-notifications"
import { notifyAdminNewOrder } from "@/lib/email/admin-inbound-notifications"
import { normalizeEnableRewardPointsSystem } from "@/lib/dripforge/reward-points-settings"
import { resolveCheckoutPointsPurchase } from "@/lib/shop/points-purchase"

function stripLeitbildPayload(item: StoredOrderItem): StoredOrderItem {
  const { leitbild: _removed, ...rest } = item
  return rest
}

export type ProcessOrderResult = {
  order: StoredOrder
  itemResults: { id: string; leitbildUrl: string | null }[]
  appliedCouponCode: string | null
  settings: AdminSettings
}

export function createOrderId(): string {
  return `df-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Bestellung validieren, Leitbilder hochladen und speichern. */
export async function processOrderPayload(
  payload: OrderPayload,
  options?: {
    orderId?: string
    paymentConfirmed?: boolean
    stripeSessionId?: string | null
    /** false = volle Punkteeinlösung ohne Gateway-Mindestbetrag (Rechnung) */
    enforceGatewayMinForPoints?: boolean
  }
): Promise<ProcessOrderResult> {
  if (!payload.items?.length || !payload.billing?.email) {
    throw new Error("Unvollständige Bestelldaten.")
  }

  const orderId = options?.orderId ?? createOrderId()
  const settings = await getSettings()
  const rewardPointsEnabled = normalizeEnableRewardPointsSystem(
    settings.enableRewardPointsSystem
  )

  const subtotal = payload.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )
  const shippingCost = getShippingCost(payload.shippingMethod)

  const rawCoupon = normalizeCouponCode(payload.couponCode ?? "")
  let appliedCoupon: {
    code: string
    discountType: "percent" | "fixed"
    discountValue: number
  } | null = null

  if (rawCoupon) {
    const coupon = await getCouponByCode(rawCoupon)
    const validation = validateCouponForCheckout(coupon, rawCoupon)
    if (!validation.valid) {
      throw new Error(validation.error)
    }
    appliedCoupon = {
      code: validation.coupon.code,
      discountType: validation.coupon.discountType,
      discountValue: validation.coupon.discountValue,
    }
  }

  if (!rewardPointsEnabled) {
    if (normalizeLoyaltyPoints(payload.pointsToRedeem ?? 0) > 0) {
      throw new Error("Treuepunkte-System ist derzeit deaktiviert.")
    }
    if (payload.pointsPurchase) {
      throw new Error("Treuepunkte-System ist derzeit deaktiviert.")
    }
  }

  let pointsPurchase: { amountChf: number; points: number } | null = null
  if (rewardPointsEnabled && payload.pointsPurchase) {
    const hasPackage = Boolean(payload.pointsPurchase.packageId?.trim())
    const hasCustom = payload.pointsPurchase.customAmountChf != null
    if (hasPackage || hasCustom) {
      const account = await getAccountByEmail(payload.billing.email)
      if (!account) {
        throw new Error("Punkte können nur mit einem Kundenkonto gekauft werden.")
      }
      const resolved = resolveCheckoutPointsPurchase(payload.pointsPurchase)
      pointsPurchase = {
        amountChf: resolved.amountChf,
        points: resolved.points,
      }
    }
  }

  const serverTotals = calculateCheckoutTotalsWithDiscounts(
    subtotal,
    shippingCost,
    settings.checkout,
    {
      coupon: appliedCoupon,
      pointsToRedeem: rewardPointsEnabled
        ? await resolvePointsToRedeem(
            payload,
            appliedCoupon,
            subtotal,
            shippingCost,
            settings.checkout,
            options
          )
        : 0,
      pointsPurchase,
    }
  )

  const itemResults = await Promise.all(
    payload.items.map(async (item) => {
      let leitbildUrl: string | null = null
      if (item.leitbild) {
        try {
          leitbildUrl = await uploadOrderLeitbild(orderId, item.id, item.leitbild)
        } catch (uploadError) {
          console.error(
            `Bestellung: Leitbild-Upload fehlgeschlagen (${orderId}, ${item.id}).`,
            uploadError
          )
        }
      }
      return { id: item.id, leitbildUrl }
    })
  )

  const items: StoredOrderItem[] = payload.items.map((item) => {
    const uploaded = itemResults.find((r) => r.id === item.id)
    return stripLeitbildPayload({
      ...item,
      leitbildUrl: uploaded?.leitbildUrl ?? null,
    })
  })

  const order: StoredOrder = {
    orderId,
    createdAt: new Date().toISOString(),
    status: "ausstehend",
    productionStatus: DEFAULT_PRODUCTION_STATUS,
    isCustomerInbound: orderHasCustomerInbound(items),
    billing: payload.billing,
    delivery: payload.delivery,
    shippingMethod: payload.shippingMethod,
    paymentMethod: payload.paymentMethod,
    paymentMethodLabel: getPaymentMethodLabel(
      payload.paymentMethod,
      settings.checkout
    ),
    items,
    totals: serverTotals,
    paymentConfirmed: options?.paymentConfirmed ?? true,
    stripeSessionId: options?.stripeSessionId ?? null,
  }

  await saveOrder(order)

  const inboundNotifications = Promise.allSettled([
    notifyOrderReceived(order, settings),
    notifyAdminNewOrder(order, settings),
  ])

  try {
    const results = await inboundNotifications
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          `Bestellung: Eingangs-Benachrichtigung fehlgeschlagen (${orderId}).`,
          result.reason
        )
      }
    }
  } catch (emailError) {
    console.error(
      `Bestellung: Eingangs-Benachrichtigung fehlgeschlagen (${orderId}).`,
      emailError
    )
  }

  if (appliedCoupon && order.paymentConfirmed) {
    await incrementCouponRedemption(appliedCoupon.code)
  }

  return {
    order,
    itemResults,
    appliedCouponCode: appliedCoupon?.code ?? null,
    settings,
  }
}

async function resolvePointsToRedeem(
  payload: OrderPayload,
  appliedCoupon: {
    code: string
    discountType: "percent" | "fixed"
    discountValue: number
  } | null,
  subtotal: number,
  shippingCost: number,
  checkoutConfig: AdminSettings["checkout"],
  options?: { enforceGatewayMinForPoints?: boolean }
): Promise<number> {
  const requested = normalizeLoyaltyPoints(payload.pointsToRedeem ?? 0)
  if (requested <= 0) return 0

  const account = await getAccountByEmail(payload.billing.email)
  if (!account) {
    throw new Error("Treuepunkte können nur mit einem Kundenkonto eingelöst werden.")
  }

  const beforePoints = calculateCheckoutTotalsWithCoupon(
    subtotal,
    shippingCost,
    checkoutConfig,
    appliedCoupon
  )
  const enforceMin = options?.enforceGatewayMinForPoints !== false
  const maxPoints = maxRedeemablePoints(
    normalizeLoyaltyPoints(account.loyaltyPoints),
    beforePoints.total,
    enforceMin ? LOYALTY_MIN_GATEWAY_PAYMENT_CHF : 0
  )

  if (requested > maxPoints) {
    throw new Error(
      maxPoints > 0
        ? `Maximal ${maxPoints} Punkte einlösbar.`
        : "Keine Punkte für diese Bestellung einlösbar."
    )
  }

  return requested
}

/** Nach Stripe- oder TWINT-Zahlung: Bestellung abschliessen, Rechnung & KI-Credits. */
export async function fulfillPaidShopOrder(
  orderId: string,
  options: {
    stripeSessionId?: string | null
    payrexxTransactionUuid?: string | null
    userId?: string | null
    totalChf?: number
  }
): Promise<{ fulfilled: boolean; aiCreditsGranted: number; loyaltyPointsGranted: number }> {
  const order = await getOrderById(orderId)
  if (!order) {
    console.warn(`Shop-Fulfillment: Bestellung ${orderId} nicht gefunden.`)
    return { fulfilled: false, aiCreditsGranted: 0, loyaltyPointsGranted: 0 }
  }

  if (order.paymentConfirmed) {
    return { fulfilled: false, aiCreditsGranted: 0, loyaltyPointsGranted: 0 }
  }

  const settings = await getSettings()
  const paymentRef =
    options.stripeSessionId?.trim() ||
    options.payrexxTransactionUuid?.trim() ||
    orderId

  const updated: StoredOrder = {
    ...order,
    paymentConfirmed: true,
    ...(options.stripeSessionId
      ? { stripeSessionId: options.stripeSessionId }
      : {}),
    ...(options.payrexxTransactionUuid
      ? { payrexxTransactionUuid: options.payrexxTransactionUuid }
      : {}),
  }
  await saveOrder(updated)

  const rawCoupon = order.totals.couponCode
  if (rawCoupon) {
    await incrementCouponRedemption(rawCoupon)
  }

  const customer = await upsertCustomerFromOrder(updated)
  const orderWithCustomer: StoredOrder = {
    ...updated,
    kundennummer: customer.kundennummer,
  }

  await applyInventoryReservationForOrder(orderWithCustomer)

  const creditEmail = options.userId?.trim() || order.billing.email
  const rewardPointsEnabled = normalizeEnableRewardPointsSystem(
    settings.enableRewardPointsSystem
  )

  const pointsRedeemed = normalizeLoyaltyPoints(order.totals.pointsRedeemed ?? 0)
  if (rewardPointsEnabled && pointsRedeemed > 0) {
    const redeem = await redeemLoyaltyPointsForOrder(
      creditEmail,
      pointsRedeemed,
      orderId
    )
    if (!redeem.success && redeem.reason !== "already_redeemed") {
      console.error(
        `Shop-Fulfillment: Punkteeinlösung fehlgeschlagen (${orderId}, ${redeem.reason}).`
      )
    }
  }

  const pointsPurchased = normalizeLoyaltyPoints(order.totals.pointsPurchased ?? 0)
  if (rewardPointsEnabled && pointsPurchased > 0) {
    const purchaseGrant = await grantLoyaltyPoints(
      creditEmail,
      pointsPurchased,
      `purchase:${orderId}`,
      "purchase",
      `Punktekauf mit Bestellung ${orderId}`
    )
    if (!purchaseGrant.success && purchaseGrant.reason !== "already_granted") {
      console.error(
        `Shop-Fulfillment: Punktekauf fehlgeschlagen (${orderId}, ${purchaseGrant.reason}).`
      )
    }
  }

  const grant = await grantAiCreditsForPaidOrder(
    creditEmail,
    order.totals.total,
    paymentRef
  )

  let loyaltyPointsGranted = 0
  if (rewardPointsEnabled) {
    const earnBase = calculateLoyaltyEarnBaseChf(order.totals)
    const loyaltyGrant = await grantLoyaltyPointsForPaidOrder(
      creditEmail,
      earnBase,
      orderId
    )
    loyaltyPointsGranted = loyaltyGrant.success ? loyaltyGrant.points : 0
  }

  console.info(
    `Shop-Fulfillment: ${orderId} bezahlt${grant.granted ? `, +${grant.credits} KI-Credits` : ""}${loyaltyPointsGranted > 0 ? `, +${loyaltyPointsGranted} Treuepunkte` : ""}.`
  )

  return {
    fulfilled: true,
    aiCreditsGranted: grant.granted ? grant.credits : 0,
    loyaltyPointsGranted,
  }
}
