import { uploadOrderLeitbild } from "@/lib/azure/upload-order-leitbild"
import {
  getOrderById,
  getSettings,
  saveOrder,
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
  getEffectiveLoyaltyPoints,
  LOYALTY_MIN_GATEWAY_PAYMENT_CHF,
} from "@/lib/konto/loyalty-points"
import { orderHasCustomerInbound } from "@/lib/admin/customer-inbound-order"
import { applyInventoryReservationForOrder } from "@/lib/admin/order-inventory-hook"
import { notifyOrderReceived } from "@/lib/email/order-notifications"
import { notifyAdminNewOrder } from "@/lib/email/admin-inbound-notifications"
import {
  buildRewardPointsPublicSettings,
  normalizeEnableRewardPointsSystem,
} from "@/lib/dripforge/reward-points-settings"
import { resolveCheckoutPointsPurchase } from "@/lib/shop/points-purchase"
import { recordOrderPaymentJournalEntry } from "@/lib/accounting/order-journal"
import {
  bindOrderToCustomer,
  resolveLoyaltyAccountEmail,
} from "@/lib/shop/bind-order-to-account"

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
    /** Session-E-Mail des eingeloggten Kunden (bindet Punkte/Konto) */
    sessionEmail?: string | null
    /**
     * true = Eingangs-Mails hier nicht senden (Caller sendet nach Punkten).
     * Default false für Stripe/TWINT-Pending-Orders.
     */
    skipInboundEmails?: boolean
  }
): Promise<ProcessOrderResult> {
  if (!payload.items?.length || !payload.billing?.email) {
    throw new Error("Unvollständige Bestelldaten.")
  }

  const accountEmail = resolveLoyaltyAccountEmail(
    options?.sessionEmail,
    payload.billing.email
  )

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
      const account = await getAccountByEmail(accountEmail)
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
            options,
            accountEmail
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
    ...(options?.sessionEmail?.trim()
      ? { accountEmail: resolveLoyaltyAccountEmail(options.sessionEmail, payload.billing.email) }
      : {}),
  }

  await saveOrder(order)
  console.info(`Bestellung: Order-Record persistiert (${orderId}).`)

  if (!options?.skipInboundEmails) {
    await sendInboundOrderEmailsSafe(order, settings)
  }

  if (appliedCoupon && order.paymentConfirmed) {
    await incrementCouponRedemption(appliedCoupon.code)
  }

  if (order.paymentConfirmed) {
    try {
      await recordOrderPaymentJournalEntry(order)
    } catch (journalError) {
      console.error(
        `Buchhaltung: Journal für Bestellung ${order.orderId} fehlgeschlagen.`,
        journalError
      )
    }
  }

  return {
    order,
    itemResults,
    appliedCouponCode: appliedCoupon?.code ?? null,
    settings,
  }
}

/** E-Mails nach erfolgreicher Bestellung — Fehler brechen den Checkout nie ab. */
export async function sendInboundOrderEmailsSafe(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<void> {
  try {
    const results = await Promise.allSettled([
      notifyOrderReceived(order, settings),
      notifyAdminNewOrder(order, settings),
    ])
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          `Bestellung: Eingangs-Benachrichtigung fehlgeschlagen (${order.orderId}).`,
          result.reason
        )
      }
    }
  } catch (emailError) {
    console.error(
      `Bestellung: Eingangs-Benachrichtigung fehlgeschlagen (${order.orderId}).`,
      emailError
    )
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
  options?: { enforceGatewayMinForPoints?: boolean },
  accountEmail?: string
): Promise<number> {
  const requested = normalizeLoyaltyPoints(payload.pointsToRedeem ?? 0)
  if (requested <= 0) return 0

  const loyaltyEmail =
    accountEmail?.trim() || normalizeCustomerEmailFallback(payload.billing.email)
  const account = await getAccountByEmail(loyaltyEmail)
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
  const rewardCfg = buildRewardPointsPublicSettings(await getSettings())
  const maxPoints = maxRedeemablePoints(
    getEffectiveLoyaltyPoints(account, rewardCfg.loyaltyPointsExpiryMonths),
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

function normalizeCustomerEmailFallback(email: string): string {
  return email.trim().toLowerCase()
}

/** Nach Stripe- oder TWINT-Zahlung: Bestellung abschliessen, Rechnung & KI-Credits. */
export async function fulfillPaidShopOrder(
  orderId: string,
  options: {
    stripeSessionId?: string | null
    payrexxTransactionUuid?: string | null
    userId?: string | null
    totalChf?: number
    saveAddressToAccount?: boolean
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
  console.info(`Shop-Fulfillment: Zahlung bestätigt, Order gespeichert (${orderId}).`)

  const rawCoupon = order.totals.couponCode
  if (rawCoupon) {
    try {
      await incrementCouponRedemption(rawCoupon)
    } catch (couponError) {
      console.error(
        `Shop-Fulfillment: Coupon-Einlösung fehlgeschlagen (${orderId}).`,
        couponError
      )
    }
  }

  const sessionEmail =
    options.userId?.trim() || order.accountEmail?.trim() || null

  let orderWithCustomer: StoredOrder = {
    ...updated,
    ...(sessionEmail ? { accountEmail: sessionEmail } : {}),
  }
  let creditEmail =
    sessionEmail ||
    order.accountEmail?.trim() ||
    normalizeCustomerEmailFallback(order.billing.email)

  try {
    const bound = await bindOrderToCustomer(updated, {
      sessionEmail,
      saveAddressToAccount: options.saveAddressToAccount === true,
    })
    orderWithCustomer = bound.order
    creditEmail = bound.accountEmail
  } catch (bindError) {
    console.error(
      `Shop-Fulfillment: Kundenbindung fehlgeschlagen (${orderId}) — fahre mit Punkten fort.`,
      bindError
    )
    try {
      await saveOrder(orderWithCustomer)
    } catch (saveError) {
      console.error(
        `Shop-Fulfillment: accountEmail konnte nicht nachgetragen werden (${orderId}).`,
        saveError
      )
    }
  }

  try {
    await applyInventoryReservationForOrder(orderWithCustomer)
  } catch (inventoryError) {
    console.error(
      `Shop-Fulfillment: Lagerreservation fehlgeschlagen (${orderId}).`,
      inventoryError
    )
  }

  const rewardCfg = buildRewardPointsPublicSettings(settings)
  const rewardPointsEnabled = rewardCfg.enableRewardPointsSystem
  let loyaltyPointsGranted = 0
  let aiCreditsGranted = 0

  try {
    const pointsRedeemed = normalizeLoyaltyPoints(order.totals.pointsRedeemed ?? 0)
    if (rewardPointsEnabled && pointsRedeemed > 0) {
      const redeem = await redeemLoyaltyPointsForOrder(
        creditEmail,
        pointsRedeemed,
        orderId,
        { expiryMonths: rewardCfg.loyaltyPointsExpiryMonths }
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
        `Punktekauf mit Bestellung ${orderId}`,
        { expiryMonths: rewardCfg.loyaltyPointsExpiryMonths }
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
    if (grant.granted) aiCreditsGranted = grant.credits

    if (rewardPointsEnabled) {
      const earnBase = calculateLoyaltyEarnBaseChf(order.totals)
      const loyaltyGrant = await grantLoyaltyPointsForPaidOrder(
        creditEmail,
        earnBase,
        orderId,
        {
          earnPercent: rewardCfg.loyaltyEarnPercent,
          expiryMonths: rewardCfg.loyaltyPointsExpiryMonths,
        }
      )
      loyaltyPointsGranted = loyaltyGrant.success ? loyaltyGrant.points : 0
    }
  } catch (pointsError) {
    console.error(
      `Shop-Fulfillment: Punkte/Credits fehlgeschlagen (${orderId}) — Bestellung bleibt erhalten.`,
      pointsError
    )
  }

  console.info(
    `Shop-Fulfillment: ${orderId} bezahlt${aiCreditsGranted > 0 ? `, +${aiCreditsGranted} KI-Credits` : ""}${loyaltyPointsGranted > 0 ? `, +${loyaltyPointsGranted} Treuepunkte` : ""}.`
  )

  try {
    await recordOrderPaymentJournalEntry(orderWithCustomer)
  } catch (journalError) {
    console.error(
      `Buchhaltung: Journal für Bestellung ${orderId} fehlgeschlagen.`,
      journalError
    )
  }

  // Falls Eingangsmail beim Pending-Checkout noch fehlte
  await sendInboundOrderEmailsSafe(orderWithCustomer, settings)

  return {
    fulfilled: true,
    aiCreditsGranted,
    loyaltyPointsGranted,
  }
}
