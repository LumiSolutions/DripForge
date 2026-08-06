import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { getOrders, getSettings } from "@/lib/admin/db"
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { buildRewardPointsPublicSettings } from "@/lib/dripforge/reward-points-settings"
import { getAccountByEmail } from "@/lib/konto/account-db"
import {
  calculateLoyaltyEarnBaseChf,
  grantLoyaltyPointsForPaidOrder,
} from "@/lib/konto/loyalty-points"

export type PaidOrderLoyaltyResult = {
  success: boolean
  points: number
  accountEmail?: string
  reason?: string
}

function isOrderPaid(order: StoredOrder): boolean {
  return order.paymentConfirmed === true || order.paymentStatus === "paid"
}

async function resolveAccountEmailForOrder(order: StoredOrder): Promise<string | null> {
  const candidates = [
    order.accountEmail,
    order.billing.email,
  ]
    .map((email) => normalizeCustomerEmail(email ?? ""))
    .filter(Boolean)

  for (const email of [...new Set(candidates)]) {
    const account = await getAccountByEmail(email)
    if (account) return account.email
  }

  return null
}

export async function grantLoyaltyPointsForPaidStoredOrder(
  order: StoredOrder,
  settings?: AdminSettings
): Promise<PaidOrderLoyaltyResult> {
  if (!isOrderPaid(order)) {
    return { success: false, points: 0, reason: "order_not_paid" }
  }

  const accountEmail = await resolveAccountEmailForOrder(order)
  if (!accountEmail) {
    return { success: false, points: 0, reason: "no_account" }
  }

  const rewardCfg = buildRewardPointsPublicSettings(settings ?? (await getSettings()))
  if (!rewardCfg.enableRewardPointsSystem) {
    return { success: false, points: 0, accountEmail, reason: "disabled" }
  }

  const earnBase = calculateLoyaltyEarnBaseChf(order.totals)
  const result = await grantLoyaltyPointsForPaidOrder(
    accountEmail,
    earnBase,
    order.orderId,
    {
      earnPercent: rewardCfg.loyaltyEarnPercent,
      expiryMonths: rewardCfg.loyaltyPointsExpiryMonths,
    }
  )

  return {
    success: result.success,
    points: result.points,
    accountEmail,
    reason: result.reason,
  }
}

export async function grantLoyaltyPointsForPaidOrdersForCustomerEmail(
  email: string
): Promise<{ checked: number; granted: number }> {
  const normalized = normalizeCustomerEmail(email)
  if (!normalized) return { checked: 0, granted: 0 }

  const orders = await getOrders()
  const matched = orders.filter((order) => {
    if (!isOrderPaid(order)) return false
    const billing = normalizeCustomerEmail(order.billing.email)
    const account = normalizeCustomerEmail(order.accountEmail ?? "")
    return billing === normalized || account === normalized
  })

  let granted = 0
  for (const order of matched) {
    const result = await grantLoyaltyPointsForPaidStoredOrder({
      ...order,
      accountEmail: order.accountEmail ?? normalized,
    })
    if (result.success) granted += result.points
  }

  return { checked: matched.length, granted }
}
