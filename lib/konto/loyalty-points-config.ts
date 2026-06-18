/** Client-sichere Konstanten und reine Hilfsfunktionen (kein Cosmos/fs). */

/** 1 Punkt = 0.10 CHF Gegenwert */
export const LOYALTY_POINT_VALUE_CHF = 0.1

/** 10 % des bezahlten Umsatzes werden als Punkte gutgeschrieben */
export const LOYALTY_EARN_RATE = 0.1

export const LOYALTY_MIN_GATEWAY_PAYMENT_CHF = 0.5

export const LOYALTY_POINT_PACKAGES = [
  { id: "100", points: 100, priceChf: 10, label: "100 Punkte" },
  { id: "500", points: 500, priceChf: 50, label: "500 Punkte" },
] as const

export type LoyaltyPointTransactionType =
  | "earn_order"
  | "redeem_order"
  | "purchase"
  | "adjustment"

export type LoyaltyPointTransaction = {
  id: string
  type: LoyaltyPointTransactionType
  points: number
  referenceId: string
  note?: string
  createdAt: string
}

export function normalizeLoyaltyPoints(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

export function loyaltyPointsToChf(points: number): number {
  return Math.round(normalizeLoyaltyPoints(points) * LOYALTY_POINT_VALUE_CHF * 100) / 100
}

export function chfToLoyaltyPoints(chf: number): number {
  if (!Number.isFinite(chf) || chf <= 0) return 0
  return Math.floor(chf / LOYALTY_POINT_VALUE_CHF)
}

export function calculateEarnedLoyaltyPoints(paidTotalChf: number): number {
  const amount = Number(paidTotalChf)
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.floor((amount * LOYALTY_EARN_RATE) / LOYALTY_POINT_VALUE_CHF)
}

export function calculatePointsDiscountChf(points: number): number {
  return loyaltyPointsToChf(points)
}

export function maxRedeemablePoints(
  availablePoints: number,
  totalBeforePoints: number,
  minPaymentChf = LOYALTY_MIN_GATEWAY_PAYMENT_CHF
): number {
  const available = normalizeLoyaltyPoints(availablePoints)
  if (available <= 0 || totalBeforePoints <= 0) return 0

  const maxDiscountChf = Math.max(0, totalBeforePoints - minPaymentChf)
  const maxFromTotal = Math.floor(maxDiscountChf / LOYALTY_POINT_VALUE_CHF)
  return Math.min(available, maxFromTotal)
}

export function createPointsPurchaseId(): string {
  return `pts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function isPointsPurchaseReference(referenceId: string): boolean {
  return referenceId.trim().startsWith("pts-")
}
