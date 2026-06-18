/**
 * Zentrale Preisparameter fuer den 3D-Konfigurator.
 * Spaeter per fetch aus Admin-Portal / Datenbank ersetzen.
 */
export type PricingConfig = {
  setupFee: number
  pricePerGramPLA: number
  densityPLA: number
  /** Infill-Anteil für Gewichtsschätzung (0–1, Standard Bambu Studio: 15 %) */
  infillFactor: number
  /** Aufschlag pro zusaetzlicher Farbe (ab der 2.), in Prozent vom Basis-Stueckpreis */
  multiColorSurchargePercentPerExtra: number
}

/** Standardwerte — PLA 1.24 g/cm³, 15 % Infill (realistische Sofort-Offerte). */
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  setupFee: 5.0,
  pricePerGramPLA: 0.025,
  densityPLA: 1.24,
  infillFactor: 0.15,
  multiColorSurchargePercentPerExtra: 15,
}
