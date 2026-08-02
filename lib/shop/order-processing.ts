import {
  uploadOrderAsset,
  uploadOrderLeitbild,
} from "@/lib/azure/upload-order-asset"
import { uploadOrderProductionLayer } from "@/lib/azure/upload-order-leitbild"
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
import {
  queueOrderEmails,
  sendOrderEmails,
  type SendOrderEmailsResult,
} from "@/lib/email/send-order-emails"
import {
  buildRewardPointsPublicSettings,
} from "@/lib/dripforge/reward-points-settings"
import { resolveCheckoutPointsPurchase } from "@/lib/shop/points-purchase"
import { recordOrderPaymentJournalEntry } from "@/lib/accounting/order-journal"
import {
  bindOrderToCustomer,
  resolveLoyaltyAccountEmail,
} from "@/lib/shop/bind-order-to-account"
import {
  normalizeOrderForPersistence,
  sanitizeOrderItemForPersistence,
} from "@/lib/admin/normalize-order"

function stripLeitbildPayload(item: StoredOrderItem): StoredOrderItem {
  return sanitizeOrderItemForPersistence(item)
}

export type ProcessOrderResult = {
  order: StoredOrder
  itemResults: {
    id: string
    leitbildUrl: string | null
    previewMockupUrl: string | null
    productionLayerUrl: string | null
    uploadedImageUrl: string | null
    uploadedImageUrls?: string[]
    layerSrcMap?: Record<string, string>
    colorReferenceImageUrl?: string | null
  }[]
  appliedCouponCode: string | null
  settings: AdminSettings
}

import { allocateOrderId } from "@/lib/admin/cosmos-order-counter"
import { createFallbackOrderId } from "@/lib/admin/order-id"

/** @deprecated Synchroner Fallback — bitte allocateFriendlyOrderId() nutzen. */
export function createOrderId(): string {
  return createFallbackOrderId()
}

/** Vergibt eine kurze Bestell-ID (DF-10042). */
export async function allocateFriendlyOrderId(): Promise<string> {
  try {
    return await allocateOrderId()
  } catch (error) {
    console.warn("Bestell-ID: Allokation fehlgeschlagen — Fallback.", error)
    return createFallbackOrderId()
  }
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

  const orderId = options?.orderId ?? (await allocateFriendlyOrderId())
  const settings = await getSettings()
  const rewardCfg = buildRewardPointsPublicSettings(settings)
  const rewardPointsEnabled = rewardCfg.enableRewardPointsSystem

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
            accountEmail,
            rewardCfg
          )
        : 0,
      pointValueChf: rewardCfg.loyaltyPointValueChf,
      pointsPurchase,
    }
  )

  const itemResults = await Promise.all(
    payload.items.map(async (item) => {
      let leitbildUrl: string | null = null
      let previewMockupUrl: string | null = null
      let productionLayerUrl: string | null = null
      let uploadedImageUrl: string | null = null
      let colorReferenceImageUrl: string | null = null

      const mockupDataUrl =
        (typeof item.previewMockup === "string" && item.previewMockup) ||
        (typeof item.leitbild === "string" && item.leitbild) ||
        null

      if (mockupDataUrl) {
        try {
          if (item.type === "laser") {
            previewMockupUrl = await uploadOrderAsset(
              orderId,
              item.id,
              "mockup",
              mockupDataUrl
            )
            // Leitbild bleibt Alias auf das Composite-Mockup (Abwärtskompatibilität)
            leitbildUrl =
              previewMockupUrl ??
              (await uploadOrderLeitbild(orderId, item.id, mockupDataUrl))
          } else {
            leitbildUrl = await uploadOrderLeitbild(
              orderId,
              item.id,
              mockupDataUrl
            )
          }
        } catch (uploadError) {
          console.error(
            `Bestellung: Vorschau-Upload fehlgeschlagen (${orderId}, ${item.id}).`,
            uploadError
          )
        }
      }

      if (item.productionLayer) {
        try {
          productionLayerUrl = await uploadOrderProductionLayer(
            orderId,
            item.id,
            item.productionLayer
          )
        } catch (uploadError) {
          console.error(
            `Bestellung: Produktions-Layer-Upload fehlgeschlagen (${orderId}, ${item.id}).`,
            uploadError
          )
        }
      }

      const logoDataUrl = item.customDetails?.uploadedImage
      if (
        typeof logoDataUrl === "string" &&
        logoDataUrl.startsWith("data:")
      ) {
        try {
          uploadedImageUrl = await uploadOrderAsset(
            orderId,
            item.id,
            "logo",
            logoDataUrl
          )
        } catch (uploadError) {
          console.error(
            `Bestellung: Logo-Upload fehlgeschlagen (${orderId}, ${item.id}).`,
            uploadError
          )
        }
      } else if (
        typeof logoDataUrl === "string" &&
        /^https?:\/\//i.test(logoDataUrl)
      ) {
        uploadedImageUrl = logoDataUrl
      }

      const extraImageSources = [
        ...(Array.isArray(item.customDetails?.uploadedImages)
          ? item.customDetails.uploadedImages
          : []),
        ...(item.customDetails?.layoutCoordinates?.layers ?? [])
          .filter((layer) => layer.kind === "image" && typeof layer.src === "string")
          .map((layer) => layer.src as string),
      ]

      const uploadedImageUrls: string[] = []
      const uniqueSources = Array.from(new Set(extraImageSources.filter(Boolean)))
      for (let i = 0; i < uniqueSources.length; i++) {
        const src = uniqueSources[i]
        if (src.startsWith("data:")) {
          try {
            const url = await uploadOrderAsset(
              orderId,
              item.id,
              `logo-${i + 1}`,
              src
            )
            if (url) uploadedImageUrls.push(url)
          } catch (uploadError) {
            console.error(
              `Bestellung: Multi-Logo-Upload fehlgeschlagen (${orderId}, ${item.id}, ${i}).`,
              uploadError
            )
          }
        } else if (/^https?:\/\//i.test(src)) {
          uploadedImageUrls.push(src)
        }
      }

      if (!uploadedImageUrl && uploadedImageUrls[0]) {
        uploadedImageUrl = uploadedImageUrls[0]
      } else if (
        uploadedImageUrl &&
        !uploadedImageUrls.includes(uploadedImageUrl)
      ) {
        uploadedImageUrls.unshift(uploadedImageUrl)
      }

      const layerSrcMap = new Map<string, string>()
      for (let i = 0; i < uniqueSources.length; i++) {
        const src = uniqueSources[i]
        const mapped = uploadedImageUrls[i]
        if (mapped) layerSrcMap.set(src, mapped)
      }

      const skizzeDataUrl = item.customDetails?.colorReferenceImage
      if (
        typeof skizzeDataUrl === "string" &&
        skizzeDataUrl.startsWith("data:")
      ) {
        try {
          colorReferenceImageUrl = await uploadOrderAsset(
            orderId,
            item.id,
            "skizze",
            skizzeDataUrl
          )
        } catch (uploadError) {
          console.error(
            `Bestellung: Farb-Skizze-Upload fehlgeschlagen (${orderId}, ${item.id}).`,
            uploadError
          )
        }
      } else if (
        typeof skizzeDataUrl === "string" &&
        /^https?:\/\//i.test(skizzeDataUrl)
      ) {
        colorReferenceImageUrl = skizzeDataUrl
      }

      return {
        id: item.id,
        leitbildUrl,
        previewMockupUrl,
        productionLayerUrl,
        uploadedImageUrl,
        uploadedImageUrls,
        layerSrcMap: Object.fromEntries(layerSrcMap),
        colorReferenceImageUrl,
      }
    })
  )

  const items: StoredOrderItem[] = payload.items.map((item) => {
    const uploaded = itemResults.find((r) => r.id === item.id)
    const layerSrcMap = uploaded?.layerSrcMap ?? {}
    const coords = item.customDetails?.layoutCoordinates
    const nextLayers = coords?.layers?.map((layer) => {
      if (layer.kind !== "image") return layer
      const mapped =
        (layer.src && layerSrcMap[layer.src]) ||
        (typeof layer.src === "string" && /^https?:\/\//i.test(layer.src)
          ? layer.src
          : null)
      return {
        ...layer,
        src: mapped,
        hasImage: Boolean(mapped || layer.hasImage),
      }
    })

    const details = item.customDetails
      ? {
          ...item.customDetails,
          ...(uploaded?.uploadedImageUrl
            ? {
                uploadedImage: uploaded.uploadedImageUrl,
                hasImage: true,
              }
            : {}),
          ...(uploaded?.uploadedImageUrls?.length
            ? { uploadedImages: uploaded.uploadedImageUrls }
            : {}),
          ...(uploaded?.colorReferenceImageUrl
            ? { colorReferenceImage: uploaded.colorReferenceImageUrl }
            : {}),
          ...(coords
            ? {
                layoutCoordinates: {
                  ...coords,
                  ...(nextLayers ? { layers: nextLayers } : {}),
                },
              }
            : {}),
        }
      : item.customDetails

    const mockupUrl = uploaded?.previewMockupUrl ?? null
    return stripLeitbildPayload({
      ...item,
      customDetails: details,
      leitbildUrl: uploaded?.leitbildUrl ?? null,
      previewMockupUrl: mockupUrl,
      // Aliase für Cockpit / API-Konsumenten
      mockupPreviewUrl: mockupUrl,
      mockup_preview_url: mockupUrl,
      productionLayerUrl: uploaded?.productionLayerUrl ?? null,
    })
  })

  const order: StoredOrder = normalizeOrderForPersistence({
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
    ...(typeof payload.customerNote === "string" && payload.customerNote.trim()
      ? { customerNote: payload.customerNote.trim().slice(0, 2000) }
      : {}),
    ...(options?.sessionEmail?.trim()
      ? { accountEmail: resolveLoyaltyAccountEmail(options.sessionEmail, payload.billing.email) }
      : {}),
  })

  // DB zuerst — erst danach (außerhalb dieses Schritts) Mails
  await saveOrder(order)
  console.info(`Bestellung: Order-Record persistiert (${orderId}).`)

  // E-Mails sind entkoppelt — Fehler hier dürfen die Bestellung nie ungültig machen.
  if (!options?.skipInboundEmails) {
    try {
      console.log("Sending order emails for order:", order.orderId)
      queueOrderEmails(order, settings)
    } catch (mailError) {
      console.error("Bestell-Mail Fehler:", mailError)
      console.error("CRITICAL_SMTP_ERROR:", mailError)
    }
  }

  if (appliedCoupon && order.paymentConfirmed) {
    try {
      await incrementCouponRedemption(appliedCoupon.code)
    } catch (couponError) {
      console.error(
        `Bestellung: Coupon-Einlösung fehlgeschlagen (${orderId}) — Bestellung bleibt gespeichert.`,
        couponError
      )
    }
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
): Promise<SendOrderEmailsResult> {
  try {
    console.log("Sending order emails for order:", order.orderId)
    return await sendOrderEmails(order, settings)
  } catch (error) {
    console.error("Bestell-Mail Fehler:", error)
    return { customerSent: false, adminSent: false }
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
  accountEmail?: string,
  rewardCfg?: ReturnType<typeof buildRewardPointsPublicSettings>
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
  const cfg = rewardCfg ?? buildRewardPointsPublicSettings(await getSettings())
  const maxPoints = maxRedeemablePoints(
    getEffectiveLoyaltyPoints(account, cfg.loyaltyPointsExpiryMonths),
    beforePoints.total,
    enforceMin ? LOYALTY_MIN_GATEWAY_PAYMENT_CHF : 0,
    cfg.loyaltyPointValueChf
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
    /** Stripe customer_details.email — überschreibt billing.email für Bestätigung */
    customerEmail?: string | null
    /** Wenn true: Eingangsmails nicht hier senden (z. B. Webhook mit eigenem try/catch) */
    skipInboundEmails?: boolean
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

  const stripeCustomerEmail = options.customerEmail?.trim().toLowerCase() || ""
  const billing =
    stripeCustomerEmail && stripeCustomerEmail !== order.billing.email.trim().toLowerCase()
      ? { ...order.billing, email: stripeCustomerEmail }
      : order.billing

  const updated: StoredOrder = {
    ...order,
    billing,
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
  // ... need to find where rewardCfg is built earlier in processOrder
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
  if (!options.skipInboundEmails) {
    await sendInboundOrderEmailsSafe(orderWithCustomer, settings)
  }

  return {
    fulfilled: true,
    aiCreditsGranted,
    loyaltyPointsGranted,
  }
}
