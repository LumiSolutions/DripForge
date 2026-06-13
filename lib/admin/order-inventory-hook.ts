import {
  consumeReservedMaterialsForOrder,
  releaseReservedMaterialsForOrder,
  reserveMaterialsForOrder,
} from "@/lib/admin/material-orders"
import { getOrderById, saveOrder } from "@/lib/admin/db"
import type { OrderStatus, StoredOrder } from "@/lib/admin/types"

export async function applyInventoryReservationForOrder(
  order: StoredOrder
): Promise<StoredOrder> {
  if (order.inventoryState === "reserved" || order.inventoryState === "consumed") {
    return order
  }

  const reserve = await reserveMaterialsForOrder(order)
  if (reserve.reservations.length === 0) {
    return order
  }

  const next: StoredOrder = {
    ...order,
    materialReservations: reserve.reservations,
    inventoryState: reserve.reserved ? "reserved" : order.inventoryState ?? "none",
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
    const next: StoredOrder = {
      ...order,
      status,
      inventoryState: "released",
    }
    await saveOrder(next)
    return next
  }

  const next: StoredOrder = { ...order, status }
  await saveOrder(next)
  return next
}
