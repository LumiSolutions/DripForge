import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { formatChf } from "@/lib/invoices/invoice-format"
import { resolveOrderInvoiceNumber } from "@/lib/invoices/order-invoice-display"

export type OrderEmailTemplates = {
  /** Einleitung der Kunden-Bestätigungsmail (Platzhalter erlaubt). Leer = Standard. */
  receivedIntro: string
  /** Schlusstext der Kunden-Bestätigungsmail (Platzhalter erlaubt). Leer = Standard. */
  receivedFooter: string
}

export const DEFAULT_ORDER_EMAIL_TEMPLATES: OrderEmailTemplates = {
  receivedIntro: [
    "Guten Tag {{customerName}},",
    "",
    "vielen Dank für Ihre Bestellung bei DripForge — wir haben Ihre Bestellung aufgenommen.",
  ].join("\n"),
  receivedFooter:
    "Wir prüfen Ihre Angaben und halten Sie über den weiteren Verlauf per E-Mail auf dem Laufenden.",
}

export const ORDER_EMAIL_PLACEHOLDER_HINT =
  "Platzhalter: {{customerName}}, {{orderNumber}}, {{totalAmount}}"

export function normalizeOrderEmailTemplates(
  value: unknown
): OrderEmailTemplates {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_ORDER_EMAIL_TEMPLATES }
  }
  const raw = value as Partial<OrderEmailTemplates>
  return {
    receivedIntro:
      typeof raw.receivedIntro === "string"
        ? raw.receivedIntro
        : DEFAULT_ORDER_EMAIL_TEMPLATES.receivedIntro,
    receivedFooter:
      typeof raw.receivedFooter === "string"
        ? raw.receivedFooter
        : DEFAULT_ORDER_EMAIL_TEMPLATES.receivedFooter,
  }
}

export type OrderEmailPlaceholderValues = {
  customerName: string
  orderNumber: string
  totalAmount: string
}

export function buildOrderEmailPlaceholders(
  order: StoredOrder
): OrderEmailPlaceholderValues {
  const customerName =
    `${order.billing.firstName} ${order.billing.lastName}`.trim() || "Kunde"
  return {
    customerName,
    orderNumber: resolveOrderInvoiceNumber(order),
    totalAmount: formatChf(order.totals.total),
  }
}

/** Ersetzt {{key}} Platzhalter (auch mit Leerzeichen: {{ key }}). */
export function applyOrderEmailPlaceholders(
  template: string,
  values: OrderEmailPlaceholderValues
): string {
  return template.replace(
    /\{\{\s*(customerName|orderNumber|totalAmount)\s*\}\}/g,
    (_match, key: keyof OrderEmailPlaceholderValues) => values[key] ?? ""
  )
}

export function resolveOrderEmailIntro(
  settings: AdminSettings | undefined,
  values: OrderEmailPlaceholderValues,
  options?: { prepaid?: boolean; vorkasseHint?: string }
): string {
  const templates = normalizeOrderEmailTemplates(settings?.orderEmailTemplates)
  const raw =
    templates.receivedIntro.trim() ||
    DEFAULT_ORDER_EMAIL_TEMPLATES.receivedIntro
  let text = applyOrderEmailPlaceholders(raw, values)
  if (options?.prepaid && options.vorkasseHint) {
    text = `${text}\n\n${options.vorkasseHint}`
  }
  return text
}

export function resolveOrderEmailFooter(
  settings: AdminSettings | undefined,
  values: OrderEmailPlaceholderValues,
  options?: { prepaid?: boolean; prepaidFallback?: string }
): string {
  const templates = normalizeOrderEmailTemplates(settings?.orderEmailTemplates)
  const raw =
    templates.receivedFooter.trim() ||
    (options?.prepaid && options.prepaidFallback
      ? options.prepaidFallback
      : DEFAULT_ORDER_EMAIL_TEMPLATES.receivedFooter)
  return applyOrderEmailPlaceholders(raw, values)
}
