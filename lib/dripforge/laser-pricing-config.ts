/**
 * Laser-Preisparameter — spaeter aus Admin-Portal / Datenbank laden.
 */
export type LaserPricingConfig = {
  /** Basis-Aufschlag pro mm² über dem Freibetrag (CHF) */
  surchargePerMm2: number
  /** Gravurfläche ohne Aufschlag (mm²) */
  freeEngravingAreaMm2: number
}

export const DEFAULT_LASER_PRICING_CONFIG: LaserPricingConfig = {
  surchargePerMm2: 0.002,
  freeEngravingAreaMm2: 2500,
}
