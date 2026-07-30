/** Öffentliche Treuepunkte-Einstellungen (Cosmos → Frontend). */

import {
  DEFAULT_LOYALTY_EARN_PERCENT,
  DEFAULT_LOYALTY_EXPIRY_MONTHS,
  DEFAULT_LOYALTY_POINT_VALUE_CHF,
  normalizeLoyaltyEarnPercent,
  normalizeLoyaltyExpiryMonths,
  normalizeLoyaltyPointValueChf,
} from "@/lib/konto/loyalty-points-config"

export type RewardPointsPublicSettings = {
  enableRewardPointsSystem: boolean
  /** Punkte-Gutschrift in % vom Einkaufswert (100 = 1 CHF → 1 Punkt). */
  loyaltyEarnPercent: number
  /** Ablaufdauer der Punkte in Monaten. */
  loyaltyPointsExpiryMonths: number
  /** Einlösewert eines Punktes in CHF (Rabatt). */
  loyaltyPointValueChf: number
}

export function normalizeEnableRewardPointsSystem(value: unknown): boolean {
  return value !== false
}

export function buildRewardPointsPublicSettings(
  input?: {
    enableRewardPointsSystem?: unknown
    loyaltyEarnPercent?: unknown
    loyaltyPointsExpiryMonths?: unknown
    loyaltyPointValueChf?: unknown
  } | null
): RewardPointsPublicSettings {
  return {
    enableRewardPointsSystem: normalizeEnableRewardPointsSystem(
      input?.enableRewardPointsSystem
    ),
    loyaltyEarnPercent: normalizeLoyaltyEarnPercent(
      input?.loyaltyEarnPercent ?? DEFAULT_LOYALTY_EARN_PERCENT
    ),
    loyaltyPointsExpiryMonths: normalizeLoyaltyExpiryMonths(
      input?.loyaltyPointsExpiryMonths ?? DEFAULT_LOYALTY_EXPIRY_MONTHS
    ),
    loyaltyPointValueChf: normalizeLoyaltyPointValueChf(
      input?.loyaltyPointValueChf ?? DEFAULT_LOYALTY_POINT_VALUE_CHF
    ),
  }
}
