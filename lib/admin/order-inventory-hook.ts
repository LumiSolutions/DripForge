import {
  consumeReservedMaterialsForOrder,
  releaseReservedMaterialsForOrder,
  reserveMaterialsForOrder,
} from "@/lib/admin/material-orders"
import {
  debitTrackedProductStockForOrder,
  restoreTrackedProductStockForOrder,
} from "@/lib/admin/product-stock"
import { getOrderById, saveOrder } from "@/lib/admin/db"
import type { OrderStatus, StoredOrder } from "@/lib/admin/types"
import { reverseLoyaltyPointsForStoredOrder } from "@/lib/shop/loyalty-order-reversal"
import { recordOrderStornoJournalEntry } from "@/lib/accounting/order-journal"

export async function applyInventoryReservationForOrder(
  order: StoredOrder
): Promise<StoredOrder> {
  let current = order

  if (!current.productStockDebited) {
    const debit = await debitTrackedProductStockForOrder(current)
    if (!debit.ok) {
      console.warn(
        `Lager: Produktbestand unvollständig für ${order.orderId}:`,
        debit.errors.join("; ")
      )
    }
    current = { ...current, productStockDebited: true }
    await saveOrder(current)
  }

  if (current.inventoryState === "reserved" || current.inventoryState === "consumed") {
    return current
  }

  const reserve = await reserveMaterialsForOrder(current)
  if (reserve.reservations.length === 0) {
    return current
  }

  const next: StoredOrder = {
    ...current,
    materialReservations: reserve.reservations,
    inventoryState: reserve.reserved ? "reserved" : current.inventoryState ?? "none",
  }
  await saveOrder(next)

  if (!reserve.reserved) {
    console.warn(
      `Lager: Reservierung unvollständig für ${order.orderId}:`,
      reserve.errors.join("; ")
    )
  }

  return next
}

export async function updateOrderStatusWithInventory(
  orderId: string,
  status: OrderStatus
): Promise<StoredOrder | null> {
  const order = await getOrderById(orderId)
  if (!order) return null

  if (status === "versendet" && order.status !== "versendet") {
    const consume = await consumeReservedMaterialsForOrder(order)
    if (!consume.ok) {
      console.warn(`Lager: Verbrauch fehlgeschlagen (${orderId}):`, consume.errors.join("; "))
    }
    const next: StoredOrder = {
      ...order,
      status,
      inventoryState: "consumed",
    }
    await saveOrder(next)
    return next
  }

  if (status === "storniert" && order.inventoryState === "reserved") {
    const release = await releaseReservedMaterialsForOrder(order)
    if (!release.ok) {
      console.warn(`Lager: Freigabe fehlgeschlagen (${orderId}):`, release.errors.join("; "))
    }
    if (order.productStockDebited) {
      const restore = await restoreTrackedProductStockForOrder(order)
      if (!restore.ok) {
        console.warn(
          `Lager: Produktbestand-Restore fehlgeschlagen (${orderId}):`,
          restore.errors.join("; ")
        )
      }
    }
    const next: StoredOrder = {
      ...order,
      status,
      inventoryState: "released",
      productStockDebited: false,
    }
    await saveOrder(next)
    if (order.status !== "storniert") {
      await reverseLoyaltyPointsForStoredOrder(next)
      try {
        await recordOrderStornoJournalEntry(next)
      } catch (error) {
        console.warn(
          `Buchhaltung: Storno-Buchung fehlgeschlagen (${orderId}).`,
          error
        )
      }
    }
    return next
  }

  const next: StoredOrder = { ...order, status }
  if (status === "storniert" && order.productStockDebited) {
    const restore = await restoreTrackedProductStockForOrder(order)
    if (!restore.ok) {
      console.warn(
        `Lager: Produktbestand-Restore fehlgeschlagen (${orderId}):`,
        restore.errors.join("; ")
      )
    }
    next.productStockDebited = false
  }
  await saveOrder(next)
  if (status === "storniert" && order.status !== "storniert") {
    await reverseLoyaltyPointsForStoredOrder(next)
    try {
      await recordOrderStornoJournalEntry(next)
    } catch (error) {
      console.warn(
        `Buchhaltung: Storno-Buchung fehlgeschlagen (${orderId}).`,
        error
      )
    }
  }
  return next
}
