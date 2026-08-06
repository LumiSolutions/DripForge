import type { StoredOrder } from "@/lib/admin/types"
import { upsertRechnungFromOrder } from "@/lib/documents/beleg-service"
import { grantLoyaltyPointsForPaidStoredOrder } from "@/lib/shop/paid-order-loyalty"

export async function syncOrderStatusSideEffects(order: StoredOrder): Promise<void> {
  try {
    await upsertRechnungFromOrder(order)
  } catch (error) {
    console.error(
      `Order-Status-Sync: Beleg-Sync fehlgeschlagen (${order.orderId}).`,
      error
    )
  }

  try {
    const grant = await grantLoyaltyPointsForPaidStoredOrder(order)
    if (grant.success) {
      console.info(
        `Order-Status-Sync: +${grant.points} Treuepunkte verbucht (${order.orderId}, ${grant.accountEmail}).`
      )
    }
  } catch (error) {
    console.error(
      `Order-Status-Sync: Treuepunkte-Sync fehlgeschlagen (${order.orderId}).`,
      error
    )
  }
}
