/** Öffentliche Treuepunkte-Einstellungen (Cosmos → Frontend). */

import {
  DEFAULT_LOYALTY_EARN_PERCENT,
  DEFAULT_LOYALTY_EXPIRY_MONTHS,
  LOYALTY_POINT_VALUE_CHF,
  normalizeLoyaltyEarnPercent,
  normalizeLoyaltyExpiryMonths,
} from "@/lib/konto/loyalty-points-config"

export type RewardPointsPublicSettings = {
  enableRewardPointsSystem: boolean
  /** Punkte-Gutschrift in % vom Einkaufswert (z. B. 10). */
  loyaltyEarnPercent: number
  /** Ablaufdauer der Punkte in Monaten. */
  loyaltyPointsExpiryMonths: number
  /** Gegenwert eines Punktes in CHF (fest 1.00). */
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
    loyaltyPointValueChf: LOYALTY_POINT_VALUE_CHF,
  }
}
