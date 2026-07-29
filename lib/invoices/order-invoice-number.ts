import type { StoredOrder } from "@/lib/admin/types"
import { updateOrderInvoice } from "@/lib/admin/db"
import {
  cosmosAllocateBelegNummer,
  cosmosFindBelegBySourceOrderId,
} from "@/lib/admin/cosmos-belege"
import {
  formatBelegDisplayId,
  isBelegStyleNumber,
  isShopOrderId,
} from "@/lib/documents/beleg-number"

/**
 * Stellt sicher, dass die Bestellung eine Rechnungsnummer hat (RE-xxxx).
 * Gibt die kanonische Beleg-ID zurück (kann Legacy RE-2026-xxxx sein) und speichert sie an der Order.
 */
export async function ensureOrderInvoiceNumber(
  order: StoredOrder
): Promise<string> {
  const existingOnOrder = order.invoiceNumber?.trim()
  if (existingOnOrder) {
    return existingOnOrder
  }

  if (isBelegStyleNumber(order.orderId) && !isShopOrderId(order.orderId)) {
    return order.orderId.trim()
  }

  const linked = await cosmosFindBelegBySourceOrderId(order.orderId)
  if (linked?.id) {
    try {
      await updateOrderInvoice(order.orderId, { invoiceNumber: linked.id })
    } catch (error) {
      console.warn(
        `Rechnungsnummer: Speichern an Order ${order.orderId} fehlgeschlagen.`,
        error
      )
    }
    return linked.id
  }

  const allocated = await cosmosAllocateBelegNummer("rechnung")
  try {
    await updateOrderInvoice(order.orderId, { invoiceNumber: allocated })
  } catch (error) {
    console.warn(
      `Rechnungsnummer: Speichern an Order ${order.orderId} fehlgeschlagen.`,
      error
    )
  }
  return allocated
}

/** Anzeige-Rechnungsnummer für PDF/E-Mail (kurz, ohne Jahr). */
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
