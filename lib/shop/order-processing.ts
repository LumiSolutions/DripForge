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
import { processOrderInvoice } from "@/lib/invoices/process-order-invoice"
import {
  DEFAULT_PRODUCTION_STATUS,
  getPaymentMethodLabel,
  type AdminSettings,
  type StoredOrder,
  type StoredOrderItem,
} from "@/lib/admin/types"
import { calculateCheckoutTotalsWithCoupon } from "@/lib/dripforge/coupon-checkout"
import { getShippingCost } from "@/lib/dripforge/checkout-config"
import type { OrderPayload } from "@/lib/dripforge/submit-order"
import { grantAiCreditsForPaidOrder } from "@/lib/konto/ai-credits"
import { applyInventoryReservationForOrder } from "@/lib/admin/order-inventory-hook"

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
  }
): Promise<ProcessOrderResult> {
  if (!payload.items?.length || !payload.billing?.email) {
    throw new Error("Unvollständige Bestelldaten.")
  }

  const orderId = options?.orderId ?? createOrderId()
  const settings = await getSettings()

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

  const serverTotals = calculateCheckoutTotalsWithCoupon(
    subtotal,
    shippingCost,
    settings.checkout,
    appliedCoupon
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

/** Nach Stripe- oder TWINT-Zahlung: Bestellung abschliessen, Rechnung & KI-Credits. */
export async function fulfillPaidShopOrder(
  orderId: string,
  options: {
    stripeSessionId?: string | null
    payrexxTransactionUuid?: string | null
    userId?: string | null
    totalChf?: number
  }
): Promise<{ fulfilled: boolean; aiCreditsGranted: number }> {
  const order = await getOrderById(orderId)
  if (!order) {
    console.warn(`Shop-Fulfillment: Bestellung ${orderId} nicht gefunden.`)
    return { fulfilled: false, aiCreditsGranted: 0 }
  }

  if (order.paymentConfirmed) {
    return { fulfilled: false, aiCreditsGranted: 0 }
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

  try {
    await processOrderInvoice(orderWithCustomer, settings)
  } catch (invoiceError) {
    console.error(
      `Shop-Fulfillment: Rechnung fehlgeschlagen (${orderId}).`,
      invoiceError
    )
  }

  const creditEmail = options.userId?.trim() || order.billing.email
  const totalChf =
    options.totalChf && options.totalChf > 0
      ? options.totalChf
      : order.totals.total
  const grant = await grantAiCreditsForPaidOrder(
    creditEmail,
    totalChf,
    paymentRef
  )

  console.info(
    `Shop-Fulfillment: ${orderId} bezahlt${grant.granted ? `, +${grant.credits} KI-Credits` : ""}.`
  )

  return {
    fulfilled: true,
    aiCreditsGranted: grant.granted ? grant.credits : 0,
  }
}
