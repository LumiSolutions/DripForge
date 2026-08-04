import {
  DEFAULT_PRODUCTION_STATUS,
  type OrderStatus,
  type StoredOrder,
  type StoredOrderItem,
} from "@/lib/admin/types"
import type { PaymentMethodId, ShippingMethodId } from "@/lib/dripforge/checkout-config"

export type OrderPaymentStatus = "pending" | "paid"

const PAYMENT_METHODS = new Set<PaymentMethodId>([
  "card",
  "twint",
  "invoice",
  "cash",
])
const SHIPPING_METHODS = new Set<ShippingMethodId>([
  "apost",
  "bpost",
  "pickup",
  "brief",
])
const ORDER_STATUSES = new Set<OrderStatus>([
  "ausstehend",
  "in_produktion",
  "versendet",
  "storniert",
])

/**
 * Entfernt Base64-/Data-URLs aus Positionen — sonst sprengt das Cosmos-Dokument
 * das 2-MB-Limit (Leitbild, Upload-Bild, Farbskizze).
 */
export function sanitizeOrderItemForPersistence(
  item: StoredOrderItem
): StoredOrderItem {
  const {
    leitbild: _leitbild,
    previewMockup: _previewMockup,
    productionLayer: _productionLayer,
    ...rest
  } = item
  const next: StoredOrderItem = {
    id: String(rest.id ?? ""),
    name: String(rest.name ?? "Artikel"),
    price: Number.isFinite(rest.price) ? rest.price : 0,
    quantity: Number.isFinite(rest.quantity) && rest.quantity > 0 ? rest.quantity : 1,
    type: rest.type === "laser" ? "laser" : "3d",
    leitbildUrl: rest.leitbildUrl ?? null,
    previewMockupUrl: rest.previewMockupUrl ?? null,
    mockupPreviewUrl:
      rest.mockupPreviewUrl ?? rest.previewMockupUrl ?? null,
    mockup_preview_url:
      rest.mockup_preview_url ??
      rest.mockupPreviewUrl ??
      rest.previewMockupUrl ??
      null,
    productionLayerUrl: rest.productionLayerUrl ?? null,
  }

  if (rest.unit) next.unit = rest.unit
  if (rest.description) next.description = rest.description

  if (rest.customDetails) {
    const details = { ...rest.customDetails }
    if (
      typeof details.uploadedImage === "string" &&
      details.uploadedImage.startsWith("data:")
    ) {
      details.uploadedImage = null
      details.hasImage = true
    }
    if (
      typeof details.colorReferenceImage === "string" &&
      details.colorReferenceImage.startsWith("data:")
    ) {
      details.colorReferenceImage = null
    }
    if (Array.isArray(details.uploadedImages)) {
      details.uploadedImages = details.uploadedImages.filter(
        (url) => typeof url === "string" && !url.startsWith("data:")
      )
      if (details.uploadedImages.length === 0) delete details.uploadedImages
    }
    if (details.layoutCoordinates?.layers) {
      details.layoutCoordinates = {
        ...details.layoutCoordinates,
        layers: details.layoutCoordinates.layers.map((layer) => {
          if (layer.kind !== "image") return layer
          const src =
            typeof layer.src === "string" && layer.src.startsWith("data:")
              ? null
              : layer.src ?? null
          return {
            ...layer,
            src,
            hasImage: Boolean(src || layer.hasImage),
          }
        }),
      }
    }
    next.customDetails = details
  }

  return next
}

function normalizePaymentMethod(value: unknown): PaymentMethodId {
  if (typeof value === "string" && PAYMENT_METHODS.has(value as PaymentMethodId)) {
    return value as PaymentMethodId
  }
  return "invoice"
}

function normalizeShippingMethod(value: unknown): ShippingMethodId {
  if (typeof value === "string" && SHIPPING_METHODS.has(value as ShippingMethodId)) {
    return value as ShippingMethodId
  }
  return "apost"
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  if (typeof value === "string" && ORDER_STATUSES.has(value as OrderStatus)) {
    return value as OrderStatus
  }
  return "ausstehend"
}

function normalizeAddress(
  address: StoredOrder["billing"] | undefined
): StoredOrder["billing"] {
  return {
    firstName: address?.firstName?.trim() || "",
    lastName: address?.lastName?.trim() || "",
    street: address?.street?.trim() || "",
    zip: address?.zip?.trim() || "",
    city: address?.city?.trim() || "",
    country: address?.country?.trim() || "CH",
    email: address?.email?.trim().toLowerCase() || "",
    phone: address?.phone?.trim() || "",
  }
}

function normalizeTotals(totals: StoredOrder["totals"] | undefined): StoredOrder["totals"] {
  const subtotal = Number(totals?.subtotal)
  const shippingCost = Number(totals?.shippingCost)
  const vat = Number(totals?.vat)
  const total = Number(totals?.total)

  return {
    subtotal: Number.isFinite(subtotal) ? subtotal : 0,
    shippingCost: Number.isFinite(shippingCost) ? shippingCost : 0,
    vat: Number.isFinite(vat) ? vat : 0,
    total: Number.isFinite(total) ? total : 0,
    mwstAktiv: Boolean(totals?.mwstAktiv),
    ...(totals?.discountAmount != null
      ? { discountAmount: Number(totals.discountAmount) || 0 }
      : {}),
    ...(totals?.couponCode ? { couponCode: String(totals.couponCode) } : {}),
    ...(totals?.pointsRedeemed != null
      ? { pointsRedeemed: Number(totals.pointsRedeemed) || 0 }
      : {}),
    ...(totals?.pointsDiscountChf != null
      ? { pointsDiscountChf: Number(totals.pointsDiscountChf) || 0 }
      : {}),
    ...(totals?.pointsPurchaseChf != null
      ? { pointsPurchaseChf: Number(totals.pointsPurchaseChf) || 0 }
      : {}),
    ...(totals?.pointsPurchased != null
      ? { pointsPurchased: Number(totals.pointsPurchased) || 0 }
      : {}),
  }
}

/**
 * Pflichtfelder + Cosmos-sichere Serialisierung vor dem Persistieren.
 * Entfernt undefined und grosse Data-URLs.
 */
export function normalizeOrderForPersistence(
  order: StoredOrder
): StoredOrder & { id: string; paymentStatus: OrderPaymentStatus } {
  const orderId =
    order.orderId?.trim() ||
    `DF-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
  const paymentConfirmed = Boolean(order.paymentConfirmed)
  const paymentMethod = normalizePaymentMethod(order.paymentMethod)
  const paymentStatus: OrderPaymentStatus = paymentConfirmed ? "paid" : "pending"

  const normalized: StoredOrder & { id: string; paymentStatus: OrderPaymentStatus } = {
    id: orderId,
    orderId,
    createdAt: order.createdAt?.trim() || new Date().toISOString(),
    status: normalizeOrderStatus(order.status),
    productionStatus: order.productionStatus ?? DEFAULT_PRODUCTION_STATUS,
    billing: normalizeAddress(order.billing),
    shippingMethod: normalizeShippingMethod(order.shippingMethod),
    paymentMethod,
    paymentMethodLabel:
      order.paymentMethodLabel?.trim() ||
      (paymentMethod === "card"
        ? "Kreditkarte"
        : paymentMethod === "twint"
          ? "TWINT"
          : "Kauf auf Rechnung"),
    items: (order.items ?? []).map(sanitizeOrderItemForPersistence),
    totals: normalizeTotals(order.totals),
    paymentConfirmed,
    paymentStatus,
    isCustomerInbound: Boolean(order.isCustomerInbound),
  }

  if (order.delivery) {
    normalized.delivery = normalizeAddress(order.delivery)
  }
  if (order.kundennummer?.trim()) {
    normalized.kundennummer = order.kundennummer.trim()
  }
  if (order.accountEmail?.trim()) {
    normalized.accountEmail = order.accountEmail.trim().toLowerCase()
  }
  if (order.stripeSessionId) {
    normalized.stripeSessionId = order.stripeSessionId
  }
  if (order.rechnungPdfUrl) normalized.rechnungPdfUrl = order.rechnungPdfUrl
  if (order.rechnungPdfPath) normalized.rechnungPdfPath = order.rechnungPdfPath
  if (order.invoiceNumber?.trim()) {
    normalized.invoiceNumber = order.invoiceNumber.trim()
  }
  if (order.payrexxGatewayHash) normalized.payrexxGatewayHash = order.payrexxGatewayHash
  if (order.payrexxTransactionUuid) {
    normalized.payrexxTransactionUuid = order.payrexxTransactionUuid
  }
  if (order.inventoryState) normalized.inventoryState = order.inventoryState
  if (order.materialReservations) {
    normalized.materialReservations = order.materialReservations
  }
  if (order.trackingNumber) normalized.trackingNumber = order.trackingNumber
  if (order.emailNotifications) {
    normalized.emailNotifications = order.emailNotifications
  }
  if (typeof order.customerNote === "string" && order.customerNote.trim()) {
    normalized.customerNote = order.customerNote.trim().slice(0, 2000)
  }

  // JSON roundtrip: keine undefined-Werte / nicht serialisierbare Felder für Cosmos
  return JSON.parse(JSON.stringify(normalized)) as StoredOrder & {
    id: string
    paymentStatus: OrderPaymentStatus
  }
}
