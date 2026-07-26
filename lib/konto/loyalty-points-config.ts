/** Client-sichere Konstanten und reine Hilfsfunktionen (kein Cosmos/fs). */

/** 1 Punkt = CHF 1.00 Gegenwert */
export const LOYALTY_POINT_VALUE_CHF = 1

/** Standard: 10 % des bezahlten Umsatzes als Punkte (überschreibbar in Admin). */
export const DEFAULT_LOYALTY_EARN_PERCENT = 10

/** Standard: Punkte ab Gutschrift 6 Monate gültig. */
export const DEFAULT_LOYALTY_EXPIRY_MONTHS = 6

/** @deprecated Nutze DEFAULT_LOYALTY_EARN_PERCENT / Admin-Einstellung. */
export const LOYALTY_EARN_RATE = DEFAULT_LOYALTY_EARN_PERCENT / 100

export const LOYALTY_MIN_GATEWAY_PAYMENT_CHF = 0.5

/** Kaufpakete: 1 Punkt = CHF 1.00 */
export const LOYALTY_POINT_PACKAGES = [
  { id: "100", points: 100, priceChf: 100, label: "100 Punkte" },
  { id: "500", points: 500, priceChf: 500, label: "500 Punkte" },
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
  /** Ablaufdatum der Gutschrift (nur bei positiven Gutschriften). */
  expiresAt?: string
}

/** Einzelne Gutschrift-Charge für FIFO-Einlösung und Ablauf. */
export type LoyaltyPointLot = {
  id: string
  points: number
  remaining: number
  createdAt: string
  expiresAt: string
  referenceId: string
  source: Extract<
    LoyaltyPointTransactionType,
    "earn_order" | "purchase" | "adjustment"
  >
}

export function normalizeLoyaltyPoints(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

export function normalizeLoyaltyEarnPercent(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_LOYALTY_EARN_PERCENT
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10))
}

export function normalizeLoyaltyExpiryMonths(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_LOYALTY_EXPIRY_MONTHS
  return Math.min(120, Math.max(1, Math.floor(n)))
}

export function loyaltyPointsToChf(points: number): number {
  return Math.round(normalizeLoyaltyPoints(points) * LOYALTY_POINT_VALUE_CHF * 100) / 100
}

export function chfToLoyaltyPoints(chf: number): number {
  if (!Number.isFinite(chf) || chf <= 0) return 0
  return Math.floor(chf / LOYALTY_POINT_VALUE_CHF)
}

/**
 * Punkte-Gutschrift aus Umsatz.
 * Bei 10 % und CHF 100 → 10 Punkte (= CHF 10.00).
 */
export function calculateEarnedLoyaltyPoints(
  paidTotalChf: number,
  earnPercent: number = DEFAULT_LOYALTY_EARN_PERCENT
): number {
  const amount = Number(paidTotalChf)
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const percent = normalizeLoyaltyEarnPercent(earnPercent)
  return Math.floor((amount * (percent / 100)) / LOYALTY_POINT_VALUE_CHF)
}

/** Umsatzbasis für Punkte-Gutschrift (ohne Punktekauf-Aufschlag). */
export function calculateLoyaltyEarnBaseChf(totals: {
  subtotal: number
  shippingCost: number
  discountAmount?: number
  pointsDiscountChf?: number
}): number {
  const base =
    totals.subtotal +
    totals.shippingCost -
    (totals.discountAmount ?? 0) -
    (totals.pointsDiscountChf ?? 0)
  return Math.max(0, Math.round(base * 100) / 100)
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

export function addMonthsToIso(iso: string, months: number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date()
    fallback.setMonth(fallback.getMonth() + normalizeLoyaltyExpiryMonths(months))
    return fallback.toISOString()
  }
  d.setMonth(d.getMonth() + normalizeLoyaltyExpiryMonths(months))
  return d.toISOString()
}

export function isLoyaltyLotExpired(
  lot: Pick<LoyaltyPointLot, "expiresAt">,
  now: Date = new Date()
): boolean {
  const exp = new Date(lot.expiresAt).getTime()
  if (!Number.isFinite(exp)) return true
  return exp <= now.getTime()
}

export function sumActiveLoyaltyLotRemaining(
  lots: LoyaltyPointLot[],
  now: Date = new Date()
): number {
  return lots.reduce((sum, lot) => {
    if (isLoyaltyLotExpired(lot, now)) return sum
    return sum + normalizeLoyaltyPoints(lot.remaining)
  }, 0)
}

/**
 * FIFO: älteste, noch gültige Lots zuerst verbrauchen.
 */
export function consumeLoyaltyLotsFifo(
  lots: LoyaltyPointLot[],
  pointsToRedeem: number,
  now: Date = new Date()
): { lots: LoyaltyPointLot[]; consumed: number } {
  let remaining = normalizeLoyaltyPoints(pointsToRedeem)
  if (remaining <= 0) return { lots: [...lots], consumed: 0 }

  const next = lots.map((lot) => ({ ...lot }))
  // Älteste zuerst
  const order = [...next.keys()].sort(
    (a, b) =>
      new Date(next[a].createdAt).getTime() - new Date(next[b].createdAt).getTime()
  )

  let consumed = 0
  for (const idx of order) {
    if (remaining <= 0) break
    const lot = next[idx]
    if (isLoyaltyLotExpired(lot, now)) {
      lot.remaining = 0
      continue
    }
    const available = normalizeLoyaltyPoints(lot.remaining)
    if (available <= 0) continue
    const take = Math.min(available, remaining)
    lot.remaining = available - take
    remaining -= take
    consumed += take
  }

  return { lots: next, consumed }
}

/**
 * Migriert Legacy-Konten ohne Lots: gesamter Saldo als eine Charge.
 */
export function ensureLoyaltyLots(
  account: {
    loyaltyPoints?: number
    loyaltyPointLots?: LoyaltyPointLot[] | null
    updatedAt?: string
  },
  expiryMonths: number = DEFAULT_LOYALTY_EXPIRY_MONTHS,
  now: Date = new Date()
): LoyaltyPointLot[] {
  const existing = Array.isArray(account.loyaltyPointLots)
    ? account.loyaltyPointLots.map((lot) => ({
        ...lot,
        points: normalizeLoyaltyPoints(lot.points),
        remaining: normalizeLoyaltyPoints(lot.remaining),
      }))
    : []

  if (existing.length > 0) return existing

  const balance = normalizeLoyaltyPoints(account.loyaltyPoints)
  if (balance <= 0) return []

  const createdAt = account.updatedAt || now.toISOString()
  return [
    {
      id: `lot-legacy-${Date.now()}`,
      points: balance,
      remaining: balance,
      createdAt,
      expiresAt: addMonthsToIso(createdAt, expiryMonths),
      referenceId: "legacy-balance",
      source: "adjustment",
    },
  ]
}
