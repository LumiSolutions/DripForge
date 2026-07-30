import { getOrderById, updateOrderEmailNotifications } from "@/lib/admin/db"
import type { OrderEmailNotifications } from "@/lib/admin/types"

/**
 * Atomarer Claim für Eingangsmails (Kunde + Admin).
 * Verhindert Doppelversand wenn Webhook und Success-Page parallel laufen.
 */
export async function claimInboundOrderEmailSend(
  orderId: string
): Promise<boolean> {
  const trimmed = orderId.trim()
  if (!trimmed) return false

  const order = await getOrderById(trimmed)
  if (!order) return false

  const notes = order.emailNotifications
  if (notes?.receivedAt || notes?.inboundQueuedAt) {
    return false
  }

  const inboundQueuedAt = new Date().toISOString()
  await updateOrderEmailNotifications(trimmed, { inboundQueuedAt })

  // Zweiter Read: bei Race gewinnt der frühere Timestamp
  const again = await getOrderById(trimmed)
  const claimedAt = again?.emailNotifications?.inboundQueuedAt
  if (claimedAt && claimedAt !== inboundQueuedAt) {
    // Ein anderer Caller hat schneller geclaimed
    if (claimedAt < inboundQueuedAt) return false
  }

  return true
}

export function hasInboundEmailBeenClaimed(
  notes: OrderEmailNotifications | undefined | null
): boolean {
  return Boolean(notes?.receivedAt || notes?.inboundQueuedAt)
}
