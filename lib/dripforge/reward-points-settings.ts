/** Öffentliche Treuepunkte-Einstellungen (Cosmos → Frontend). */

export type RewardPointsPublicSettings = {
  enableRewardPointsSystem: boolean
}

export function normalizeEnableRewardPointsSystem(value: unknown): boolean {
  return value !== false
}

export function buildRewardPointsPublicSettings(
  input?: { enableRewardPointsSystem?: unknown } | null
): RewardPointsPublicSettings {
  return {
    enableRewardPointsSystem: normalizeEnableRewardPointsSystem(
      input?.enableRewardPointsSystem
    ),
  }
}
