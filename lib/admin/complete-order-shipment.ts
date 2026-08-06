import { getOrderById, updateOrderShipmentDetails } from "@/lib/admin/db"
import { updateOrderStatusWithInventory } from "@/lib/admin/order-inventory-hook"
import {
  isValidTrackingNumber,
  normalizeTrackingNumber,
} from "@/lib/admin/production-status"
import type { StoredOrder } from "@/lib/admin/types"

export type CompleteShipmentResult = {
  order: StoredOrder
  emailSent: boolean
}

export async function completeOrderShipment(
  orderId: string,
  trackingNumber?: string | null
): Promise<CompleteShipmentResult | null> {
  const normalized = normalizeTrackingNumber(trackingNumber ?? "")
  if (normalized && !isValidTrackingNumber(normalized)) return null

  const existing = await getOrderById(orderId)
  if (!existing) return null

  let order = existing
  if (existing.status !== "versendet") {
    const updated = await updateOrderStatusWithInventory(orderId, "versendet")
    if (!updated) return null
    order = updated
  }

  const saved = await updateOrderShipmentDetails(orderId, {
    status: "versendet",
    productionStatus: "versendet",
    trackingNumber: normalized || undefined,
  })
  if (!saved) return null

  return { order: saved, emailSent: false }
}
