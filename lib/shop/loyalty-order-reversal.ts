import { getSettings } from "@/lib/admin/db"
import type { StoredOrder } from "@/lib/admin/types"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { buildRewardPointsPublicSettings } from "@/lib/dripforge/reward-points-settings"
import {
  reverseLoyaltyPointsForOrder,
  type ReverseLoyaltyForOrderResult,
} from "@/lib/konto/loyalty-points"

function resolveOrderLoyaltyEmail(order: StoredOrder): string {
  return (
    normalizeCustomerEmail(order.accountEmail ?? "") ||
    normalizeCustomerEmail(order.billing?.email ?? "")
  )
}

/**
 * Treuepunkte bei Storno oder Hard-Delete rückabwickeln.
 * Fehler werden geloggt, brechen den Hauptablauf aber nicht hart ab.
 */
export async function reverseLoyaltyPointsForStoredOrder(
  order: StoredOrder
): Promise<ReverseLoyaltyForOrderResult | null> {
  const email = resolveOrderLoyaltyEmail(order)
  if (!email) {
    console.warn(
      `Treuepunkte-Storno: Keine Kunden-E-Mail für ${order.orderId}.`
    )
    return null
  }

  try {
    const settings = await getSettings()
    const rewardCfg = buildRewardPointsPublicSettings(settings)
    if (!rewardCfg.enableRewardPointsSystem) {
      return {
        success: true,
        revokedEarn: 0,
        restoredRedeem: 0,
        revokedPurchase: 0,
        reason: "disabled",
      }
    }

    const result = await reverseLoyaltyPointsForOrder(email, order, {
      expiryMonths: rewardCfg.loyaltyPointsExpiryMonths,
    })

    if (
      result.revokedEarn > 0 ||
      result.restoredRedeem > 0 ||
      result.revokedPurchase > 0
    ) {
      console.info(
        `Treuepunkte-Storno ${order.orderId}: earn -${result.revokedEarn}, redeem +${result.restoredRedeem}, purchase -${result.revokedPurchase}`
      )
    }

    return result
  } catch (error) {
    console.error(
      `Treuepunkte-Storno fehlgeschlagen (${order.orderId}).`,
      error
    )
    return null
  }
}
