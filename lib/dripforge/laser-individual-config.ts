/** Einheitlicher Richtpreis für personalisierte Laserkreationen (Offerte folgt). */
export const INDIVIDUAL_LASER_FROM_PRICE_CHF = 20

/** @deprecated Einzelpreise entfernt — immer {@link INDIVIDUAL_LASER_FROM_PRICE_CHF}. */
export const INDIVIDUAL_LASER_MATERIAL_BASE_PRICES: Record<string, number> = {
  wood: INDIVIDUAL_LASER_FROM_PRICE_CHF,
  acrylic: INDIVIDUAL_LASER_FROM_PRICE_CHF,
  leather: INDIVIDUAL_LASER_FROM_PRICE_CHF,
  stone: INDIVIDUAL_LASER_FROM_PRICE_CHF,
  edelstahl: INDIVIDUAL_LASER_FROM_PRICE_CHF,
}

export function getIndividualLaserBasePrice(_materialId?: string): number {
  return INDIVIDUAL_LASER_FROM_PRICE_CHF
}

export function formatIndividualLaserFromPrice(): string {
  return `ab CHF ${INDIVIDUAL_LASER_FROM_PRICE_CHF.toFixed(2)}`
}
