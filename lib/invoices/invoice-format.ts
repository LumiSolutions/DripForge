import type { StoredOrder } from "@/lib/admin/types"

export function formatInvoiceDate(iso: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso))
}

export function formatChf(amount: number): string {
  return `CHF ${amount.toFixed(2)}`
}

export const DRIPFORGE_LOGO_URL =
  "/placeholder.svg"

export const INVOICE_PAYMENT_TERMS_DAYS = 30

export function getInvoicePaymentTermsLabel(
  paymentMethod: StoredOrder["paymentMethod"],
  paymentTermsDays = INVOICE_PAYMENT_TERMS_DAYS
): string {
  if (paymentMethod === "invoice") {
    return `${paymentTermsDays} Tage netto`
  }
  return "Bei Bestellung"
}

/** Bestellung bereits online (Karte/TWINT) bezahlt — Quittung statt Zahlungsaufruf. */
export function isOrderAlreadyPaid(order: StoredOrder): boolean {
  if (order.paymentMethod === "invoice") return false
  if (order.paymentMethod !== "card" && order.paymentMethod !== "twint") {
    return false
  }
  if (order.paymentConfirmed === true) return true
  if (order.paymentConfirmed === false) return false
  // Legacy-/Fallback: Gateway-Spuren ohne explizites Flag
  return Boolean(order.stripeSessionId || order.payrexxTransactionUuid)
}

export function getOrderPaymentMethodDisplayLabel(order: StoredOrder): string {
  const label = order.paymentMethodLabel?.trim()
  if (label) {
    if (/kreditkarte|card|stripe/i.test(label)) return "Kreditkarte"
    if (/twint/i.test(label)) return "TWINT"
    return label
  }
  if (order.paymentMethod === "card") return "Kreditkarte"
  if (order.paymentMethod === "twint") return "TWINT"
  return "Online-Zahlung"
}

export function getInvoiceDueDateLabel(
  createdAt: string,
  paymentMethod: StoredOrder["paymentMethod"],
  paymentTermsDays = INVOICE_PAYMENT_TERMS_DAYS
): string {
  if (paymentMethod !== "invoice") return "—"
  const due = new Date(createdAt)
  due.setDate(due.getDate() + paymentTermsDays)
  return formatInvoiceDate(due.toISOString())
}
