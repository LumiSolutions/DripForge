/** Basispreise CHF — spaeter aus Admin-Portal / Datenbank */
export const INDIVIDUAL_LASER_MATERIAL_BASE_PRICES: Record<string, number> = {
  wood: 15,
  acrylic: 25,
  leather: 35,
  stone: 45,
  edelstahl: 55,
}

export function getIndividualLaserBasePrice(materialId: string): number {
  return INDIVIDUAL_LASER_MATERIAL_BASE_PRICES[materialId] ?? 40
}
