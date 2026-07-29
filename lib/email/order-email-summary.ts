import { SHIPPING_OPTIONS } from "@/lib/dripforge/checkout-config"
import type { OrderAddress } from "@/lib/dripforge/submit-order"
import type { StoredOrder } from "@/lib/admin/types"
import { formatChf, formatInvoiceDate } from "@/lib/invoices/invoice-format"
import {
  resolveOrderBestellRef,
  resolveOrderInvoiceNumber,
} from "@/lib/invoices/order-invoice-display"

export function formatOrderAddressBlock(
  label: string,
  address: OrderAddress
): string {
  return [
    label,
    `${address.firstName} ${address.lastName}`.trim(),
    address.street,
    `${address.zip} ${address.city}`.trim(),
    address.country,
    address.email ? `E-Mail: ${address.email}` : null,
    address.phone ? `Tel.: ${address.phone}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

export function resolveShippingLabel(order: StoredOrder): string {
  return (
    SHIPPING_OPTIONS.find((option) => option.id === order.shippingMethod)?.label ??
    order.shippingMethod
  )
}

export function resolvePaymentStatusLabel(order: StoredOrder): string {
  if (order.status === "storniert") return "Storniert"
  // Vorkasse: Rechnung (neu) & pending TWINT — Status klar als wartend ausweisen
  if (order.paymentMethod === "invoice" && order.status === "ausstehend") {
    return "Wartet auf Zahlungseingang (Vorkasse)"
  }
  if (order.paymentMethod === "twint" && !order.paymentConfirmed) {
    return "Wartet auf TWINT-Zahlung"
  }
  if (order.paymentConfirmed) {
    if (order.stripeSessionId) return "Bezahlt (Stripe)"
    return "Bezahlt / bestätigt"
  }
  if (order.paymentMethod === "invoice") return "Rechnung — Zahlung ausstehend"
  return "Zahlung ausstehend"
}

export function formatOrderTotalsBlock(order: StoredOrder): string {
  const lines = [
    `Zwischensumme: ${formatChf(order.totals.subtotal)}`,
    `Versand: ${formatChf(order.totals.shippingCost)}`,
  ]

  if ((order.totals.discountAmount ?? 0) > 0) {
    lines.push(`Rabatt: −${formatChf(order.totals.discountAmount ?? 0)}`)
  }
  if ((order.totals.pointsDiscountChf ?? 0) > 0) {
    lines.push(
      `Treuepunkte: −${formatChf(order.totals.pointsDiscountChf ?? 0)}`
    )
  }
  if ((order.totals.pointsPurchaseChf ?? 0) > 0) {
    lines.push(
      `Punktekauf: ${formatChf(order.totals.pointsPurchaseChf ?? 0)}`
    )
  }
  if (order.totals.mwstAktiv) {
    lines.push(`MwSt.: ${formatChf(order.totals.vat)}`)
  }
  lines.push(`Gesamtbetrag: ${formatChf(order.totals.total)}`)
  return lines.join("\n")
}

export function formatOrderSummaryPlain(order: StoredOrder): string {
  const delivery = order.delivery ?? order.billing
  const itemLines = order.items.map(
    (item) =>
      `- ${item.quantity}x ${item.name} (${formatChf(item.price * item.quantity)})`
  )
  const invoiceNumber = resolveOrderInvoiceNumber(order)
  const bestellRef = resolveOrderBestellRef(order)
  const hasInvoiceNumber =
    Boolean(order.invoiceNumber?.trim()) || invoiceNumber !== order.orderId

  return [
    hasInvoiceNumber
      ? `Rechnungsnummer: ${invoiceNumber}`
      : `Bestellnummer: ${order.orderId}`,
    bestellRef && hasInvoiceNumber ? `Bestell-Ref: ${bestellRef}` : null,
    `Datum: ${formatInvoiceDate(order.createdAt)}`,
    `Zahlungsart: ${order.paymentMethodLabel}`,
    `Zahlungsstatus: ${resolvePaymentStatusLabel(order)}`,
    `Versandart: ${resolveShippingLabel(order)}`,
    "",
    "Artikel:",
    ...itemLines,
    "",
    formatOrderTotalsBlock(order),
    "",
    formatOrderAddressBlock("Rechnungsadresse:", order.billing),
    "",
    formatOrderAddressBlock("Lieferadresse:", delivery),
  ]
    .filter((line) => line != null)
    .join("\n")
}
