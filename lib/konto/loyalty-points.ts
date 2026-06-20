import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { getAccountByEmail, saveAccount } from "@/lib/konto/account-db"
import type { CustomerAccount } from "@/lib/konto/account-types"
import {
  calculateEarnedLoyaltyPoints,
  createPointsPurchaseId,
  isPointsPurchaseReference,
  normalizeLoyaltyPoints,
  type LoyaltyPointTransaction,
  type LoyaltyPointTransactionType,
} from "@/lib/konto/loyalty-points-config"

export {
  LOYALTY_POINT_VALUE_CHF,
  LOYALTY_EARN_RATE,
  LOYALTY_MIN_GATEWAY_PAYMENT_CHF,
  LOYALTY_POINT_PACKAGES,
  normalizeLoyaltyPoints,
  loyaltyPointsToChf,
  chfToLoyaltyPoints,
  calculateEarnedLoyaltyPoints,
  calculatePointsDiscountChf,
  calculateLoyaltyEarnBaseChf,
  maxRedeemablePoints,
  createPointsPurchaseId,
  isPointsPurchaseReference,
} from "@/lib/konto/loyalty-points-config"

export type { LoyaltyPointTransaction, LoyaltyPointTransactionType }

function ensureGrantMap(account: CustomerAccount): Record<string, number> {
  return { ...(account.loyaltyPointGrants ?? {}) }
}

function ensureLedger(account: CustomerAccount): LoyaltyPointTransaction[] {
  return [...(account.loyaltyPointTransactions ?? [])]
}

function appendTransaction(
  account: CustomerAccount,
  entry: Omit<LoyaltyPointTransaction, "id" | "createdAt"> & {
    id?: string
    createdAt?: string
  }
): LoyaltyPointTransaction[] {
  const ledger = ensureLedger(account)
  const tx: LoyaltyPointTransaction = {
    id: entry.id ?? `lpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: entry.type,
    points: entry.points,
    referenceId: entry.referenceId,
    note: entry.note,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  }
  ledger.push(tx)
  return ledger.slice(-100)
}

export type LoyaltyPointsMutationResult = {
  success: boolean
  newBalance: number
  points: number
  reason?: string
}

export async function grantLoyaltyPoints(
  email: string,
  points: number,
  referenceId: string,
  type: LoyaltyPointTransactionType,
  note?: string
): Promise<LoyaltyPointsMutationResult> {
  const normalizedEmail = normalizeCustomerEmail(email)
  const ref = referenceId?.trim()
  const amount = normalizeLoyaltyPoints(points)

  if (!normalizedEmail || !ref || amount <= 0) {
    return { success: false, newBalance: 0, points: 0, reason: "invalid_input" }
  }

  const account = await getAccountByEmail(normalizedEmail)
  if (!account) {
    return { success: false, newBalance: 0, points: 0, reason: "no_account" }
  }

  const grants = ensureGrantMap(account)
  if (grants[ref] != null) {
    return {
      success: false,
      newBalance: normalizeLoyaltyPoints(account.loyaltyPoints),
      points: grants[ref],
      reason: "already_granted",
    }
  }

  const newBalance = normalizeLoyaltyPoints(account.loyaltyPoints) + amount
  grants[ref] = amount

  await saveAccount({
    ...account,
    loyaltyPoints: newBalance,
    loyaltyPointGrants: grants,
    loyaltyPointTransactions: appendTransaction(account, {
      type,
      points: amount,
      referenceId: ref,
      note,
    }),
  })

  return { success: true, newBalance, points: amount }
}

export async function grantLoyaltyPointsForPaidOrder(
  email: string,
  paidTotalChf: number,
  orderId: string
): Promise<LoyaltyPointsMutationResult> {
  const earned = calculateEarnedLoyaltyPoints(paidTotalChf)
  if (earned <= 0) {
    return { success: false, newBalance: 0, points: 0, reason: "below_threshold" }
  }
  return grantLoyaltyPoints(
    email,
    earned,
    `earn:${orderId}`,
    "earn_order",
    `Bestellung ${orderId}`
  )
}

export async function redeemLoyaltyPointsForOrder(
  email: string,
  points: number,
  orderId: string
): Promise<LoyaltyPointsMutationResult> {
  const normalizedEmail = normalizeCustomerEmail(email)
  const ref = orderId?.trim()
  const amount = normalizeLoyaltyPoints(points)

  if (!normalizedEmail || !ref || amount <= 0) {
    return { success: false, newBalance: 0, points: 0, reason: "invalid_input" }
  }

  const account = await getAccountByEmail(normalizedEmail)
  if (!account) {
    return { success: false, newBalance: 0, points: 0, reason: "no_account" }
  }

  const grants = ensureGrantMap(account)
  if (grants[`redeem:${ref}`] != null) {
    return {
      success: false,
      newBalance: normalizeLoyaltyPoints(account.loyaltyPoints),
      points: grants[`redeem:${ref}`],
      reason: "already_redeemed",
    }
  }

  const balance = normalizeLoyaltyPoints(account.loyaltyPoints)
  if (balance < amount) {
    return { success: false, newBalance: balance, points: 0, reason: "insufficient_points" }
  }

  const newBalance = balance - amount
  grants[`redeem:${ref}`] = amount

  await saveAccount({
    ...account,
    loyaltyPoints: newBalance,
    loyaltyPointGrants: grants,
    loyaltyPointTransactions: appendTransaction(account, {
      type: "redeem_order",
      points: -amount,
      referenceId: ref,
      note: `Einlösung Bestellung ${ref}`,
    }),
  })

  return { success: true, newBalance, points: amount }
}
