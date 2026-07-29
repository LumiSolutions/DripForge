import type { StoredOrder } from "@/lib/admin/types"
import { updateOrderInvoice } from "@/lib/admin/db"
import {
  cosmosAllocateBelegNummer,
  cosmosFindBelegBySourceOrderId,
} from "@/lib/admin/cosmos-belege"
import {
  isBelegStyleNumber,
  isShopOrderId,
} from "@/lib/documents/beleg-number"

/**
 * Server-only: stellt sicher, dass die Bestellung eine Rechnungsnummer hat (RE-xxxx).
 * Gibt die kanonische Beleg-ID zurück und speichert sie an der Order.
 * Nicht aus Client Components importieren.
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
