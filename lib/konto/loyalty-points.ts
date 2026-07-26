import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { getAccountByEmail, saveAccount } from "@/lib/konto/account-db"
import type { CustomerAccount } from "@/lib/konto/account-types"
import {
  addMonthsToIso,
  calculateEarnedLoyaltyPoints,
  consumeLoyaltyLotsFifo,
  DEFAULT_LOYALTY_EXPIRY_MONTHS,
  ensureLoyaltyLots,
  isPointsPurchaseReference,
  normalizeLoyaltyExpiryMonths,
  normalizeLoyaltyPoints,
  sumActiveLoyaltyLotRemaining,
  type LoyaltyPointLot,
  type LoyaltyPointTransaction,
  type LoyaltyPointTransactionType,
} from "@/lib/konto/loyalty-points-config"

export {
  LOYALTY_POINT_VALUE_CHF,
  LOYALTY_EARN_RATE,
  DEFAULT_LOYALTY_EARN_PERCENT,
  DEFAULT_LOYALTY_EXPIRY_MONTHS,
  LOYALTY_MIN_GATEWAY_PAYMENT_CHF,
  LOYALTY_POINT_PACKAGES,
  normalizeLoyaltyPoints,
  normalizeLoyaltyEarnPercent,
  normalizeLoyaltyExpiryMonths,
  loyaltyPointsToChf,
  chfToLoyaltyPoints,
  calculateEarnedLoyaltyPoints,
  calculatePointsDiscountChf,
  calculateLoyaltyEarnBaseChf,
  maxRedeemablePoints,
  createPointsPurchaseId,
  isPointsPurchaseReference,
  addMonthsToIso,
  ensureLoyaltyLots,
  sumActiveLoyaltyLotRemaining,
} from "@/lib/konto/loyalty-points-config"

export type {
  LoyaltyPointTransaction,
  LoyaltyPointTransactionType,
  LoyaltyPointLot,
} from "@/lib/konto/loyalty-points-config"

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
    expiresAt: entry.expiresAt,
  }
  ledger.push(tx)
  return ledger.slice(-100)
}

function withSyncedBalance(
  account: CustomerAccount,
  lots: LoyaltyPointLot[],
  now = new Date()
): Pick<
  CustomerAccount,
  "loyaltyPoints" | "loyaltyPointLots"
> {
  const cleaned = lots.map((lot) => {
    if (new Date(lot.expiresAt).getTime() <= now.getTime()) {
      return { ...lot, remaining: 0 }
    }
    return lot
  })
  return {
    loyaltyPointLots: cleaned,
    loyaltyPoints: sumActiveLoyaltyLotRemaining(cleaned, now),
  }
}

export function getEffectiveLoyaltyPoints(
  account: CustomerAccount,
  expiryMonths: number = DEFAULT_LOYALTY_EXPIRY_MONTHS,
  now: Date = new Date()
): number {
  const lots = ensureLoyaltyLots(account, expiryMonths, now)
  return sumActiveLoyaltyLotRemaining(lots, now)
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
  type: Extract<
    LoyaltyPointTransactionType,
    "earn_order" | "purchase" | "adjustment"
  >,
  note?: string,
  options?: { expiryMonths?: number }
): Promise<LoyaltyPointsMutationResult> {
  const normalizedEmail = normalizeCustomerEmail(email)
  const ref = referenceId?.trim()
  const amount = normalizeLoyaltyPoints(points)
  const expiryMonths = normalizeLoyaltyExpiryMonths(
    options?.expiryMonths ?? DEFAULT_LOYALTY_EXPIRY_MONTHS
  )

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
      newBalance: getEffectiveLoyaltyPoints(account, expiryMonths),
      points: grants[ref],
      reason: "already_granted",
    }
  }

  const now = new Date()
  const createdAt = now.toISOString()
  const expiresAt = addMonthsToIso(createdAt, expiryMonths)
  const lots = ensureLoyaltyLots(account, expiryMonths, now)
  lots.push({
    id: `lot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    points: amount,
    remaining: amount,
    createdAt,
    expiresAt,
    referenceId: ref,
    source: type,
  })

  grants[ref] = amount
  const synced = withSyncedBalance(account, lots, now)

  await saveAccount({
    ...account,
    ...synced,
    loyaltyPointGrants: grants,
    loyaltyPointTransactions: appendTransaction(account, {
      type,
      points: amount,
      referenceId: ref,
      note,
      expiresAt,
      createdAt,
    }),
  })

  return { success: true, newBalance: synced.loyaltyPoints!, points: amount }
}

export async function grantLoyaltyPointsForPaidOrder(
  email: string,
  paidTotalChf: number,
  orderId: string,
  options?: { earnPercent?: number; expiryMonths?: number }
): Promise<LoyaltyPointsMutationResult> {
  const earned = calculateEarnedLoyaltyPoints(
    paidTotalChf,
    options?.earnPercent
  )
  if (earned <= 0) {
    return { success: false, newBalance: 0, points: 0, reason: "below_threshold" }
  }
  return grantLoyaltyPoints(
    email,
    earned,
    `earn:${orderId}`,
    "earn_order",
    `Bestellung ${orderId}`,
    { expiryMonths: options?.expiryMonths }
  )
}

export async function redeemLoyaltyPointsForOrder(
  email: string,
  points: number,
  orderId: string,
  options?: { expiryMonths?: number }
): Promise<LoyaltyPointsMutationResult> {
  const normalizedEmail = normalizeCustomerEmail(email)
  const ref = orderId?.trim()
  const amount = normalizeLoyaltyPoints(points)
  const expiryMonths = normalizeLoyaltyExpiryMonths(
    options?.expiryMonths ?? DEFAULT_LOYALTY_EXPIRY_MONTHS
  )

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
      newBalance: getEffectiveLoyaltyPoints(account, expiryMonths),
      points: grants[`redeem:${ref}`],
      reason: "already_redeemed",
    }
  }

  const now = new Date()
  const lots = ensureLoyaltyLots(account, expiryMonths, now)
  const balance = sumActiveLoyaltyLotRemaining(lots, now)
  if (balance < amount) {
    return { success: false, newBalance: balance, points: 0, reason: "insufficient_points" }
  }

  const { lots: afterLots, consumed } = consumeLoyaltyLotsFifo(lots, amount, now)
  if (consumed < amount) {
    return {
      success: false,
      newBalance: sumActiveLoyaltyLotRemaining(afterLots, now),
      points: 0,
      reason: "insufficient_points",
    }
  }

  grants[`redeem:${ref}`] = amount
  const synced = withSyncedBalance(account, afterLots, now)

  await saveAccount({
    ...account,
    ...synced,
    loyaltyPointGrants: grants,
    loyaltyPointTransactions: appendTransaction(account, {
      type: "redeem_order",
      points: -amount,
      referenceId: ref,
      note: `Einlösung Bestellung ${ref}`,
    }),
  })

  return { success: true, newBalance: synced.loyaltyPoints!, points: amount }
}

/** Entfernt abgelaufene Restpunkte und synchronisiert den Saldo (optional persistieren). */
export async function syncLoyaltyAccountBalance(
  email: string,
  expiryMonths: number = DEFAULT_LOYALTY_EXPIRY_MONTHS
): Promise<CustomerAccount | null> {
  const account = await getAccountByEmail(normalizeCustomerEmail(email))
  if (!account) return null
  const now = new Date()
  const lots = ensureLoyaltyLots(account, expiryMonths, now)
  const synced = withSyncedBalance(account, lots, now)
  if (
    synced.loyaltyPoints === normalizeLoyaltyPoints(account.loyaltyPoints) &&
    JSON.stringify(synced.loyaltyPointLots) ===
      JSON.stringify(account.loyaltyPointLots ?? [])
  ) {
    return account
  }
  return saveAccount({ ...account, ...synced })
}