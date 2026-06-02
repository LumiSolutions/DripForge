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
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2016.%20Mai%202026%2C%2022_19_51-CjFqSwPCG95cJ4BMP2Ono6hKObBX8y.png"

export const INVOICE_PAYMENT_TERMS_DAYS = 30

export function getInvoicePaymentTermsLabel(
  paymentMethod: StoredOrder["paymentMethod"]
): string {
  if (paymentMethod === "invoice") {
    return `${INVOICE_PAYMENT_TERMS_DAYS} Tage netto`
  }
  return "Bei Bestellung"
}

export function getInvoiceDueDateLabel(
  createdAt: string,
  paymentMethod: StoredOrder["paymentMethod"]
): string {
  if (paymentMethod !== "invoice") return "—"
  const due = new Date(createdAt)
  due.setDate(due.getDate() + INVOICE_PAYMENT_TERMS_DAYS)
  return formatInvoiceDate(due.toISOString())
}
