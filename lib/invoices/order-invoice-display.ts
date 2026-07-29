import type { StoredOrder } from "@/lib/admin/types"
import {
  formatBelegDisplayId,
  isBelegStyleNumber,
  isShopOrderId,
} from "@/lib/documents/beleg-number"

/**
 * Anzeige-Rechnungsnummer für PDF/E-Mail/Admin (kurz, ohne Jahr).
 * Rein funktional — keine DB-Imports (Client-sicher).
 */
export function resolveOrderInvoiceNumber(order: StoredOrder): string {
  if (order.invoiceNumber?.trim()) {
    return formatBelegDisplayId(order.invoiceNumber.trim())
  }
  if (isBelegStyleNumber(order.orderId)) {
    return formatBelegDisplayId(order.orderId)
  }
  return order.orderId
}

/** Interne Shop-Bestell-ID nur wenn sinnvoll als Bestell-Ref. */
export function resolveOrderBestellRef(order: StoredOrder): string | null {
  if (isShopOrderId(order.orderId)) return order.orderId
  return null
}
