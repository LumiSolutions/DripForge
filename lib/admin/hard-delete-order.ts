import {
  cosmosFindBelegeBySourceOrderId,
  cosmosDeleteBeleg,
} from "@/lib/admin/cosmos-belege"
import { cosmosGetCustomerByEmail } from "@/lib/admin/cosmos-store"
import { saveCustomer } from "@/lib/admin/customer-store"
import { deleteOrder, getCustomerByNumber, getOrderById } from "@/lib/admin/db"
import { CosmosDatabaseError } from "@/lib/admin/storage-bridge"
import { reverseLoyaltyPointsForStoredOrder } from "@/lib/shop/loyalty-order-reversal"
import { recordOrderStornoJournalEntry } from "@/lib/accounting/order-journal"

export class HardDeleteOrderError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "HardDeleteOrderError"
  }
}

/**
 * Unwiderrufliches Löschen einer Bestellung inkl. verknuepfter Belege
 * und Entfernen der Order-ID aus dem CRM-Kunden.
 */
export async function hardDeleteOrder(orderId: string): Promise<void> {
  const trimmed = orderId.trim()
  if (!trimmed) {
    throw new HardDeleteOrderError("Bestell-ID fehlt.", 400)
  }

  const order = await getOrderById(trimmed)
  if (!order) {
    throw new HardDeleteOrderError("Bestellung nicht gefunden.", 404)
  }

  await reverseLoyaltyPointsForStoredOrder(order)

  try {
    await recordOrderStornoJournalEntry(order)
  } catch (error) {
    console.warn(
      `Buchhaltung: Storno-Buchung vor Löschen fehlgeschlagen (${trimmed}).`,
      error
    )
  }

  try {
    const belege = await cosmosFindBelegeBySourceOrderId(trimmed)
    for (const beleg of belege) {
      await cosmosDeleteBeleg(beleg.id)
    }
  } catch (error) {
    if (error instanceof CosmosDatabaseError) throw error
    console.warn("Hard-Delete Order: Belege konnten nicht bereinigt werden.", error)
  }

  try {
    const customer =
      (order.kundennummer
        ? await getCustomerByNumber(order.kundennummer)
        : null) ?? (await cosmosGetCustomerByEmail(order.billing.email))

    if (customer?.orderIds.includes(trimmed)) {
      await saveCustomer({
        ...customer,
        orderIds: customer.orderIds.filter((id) => id !== trimmed),
        updatedAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    if (error instanceof CosmosDatabaseError) throw error
    console.warn(
      "Hard-Delete Order: Kunden-Verknüpfung konnte nicht aktualisiert werden.",
      error
    )
  }

  const deleted = await deleteOrder(trimmed)
  if (!deleted) {
    throw new HardDeleteOrderError("Bestellung konnte nicht gelöscht werden.", 500)
  }
}
