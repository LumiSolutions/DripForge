/**
 * Zentrale Preisparameter fuer den 3D-Konfigurator.
 * Spaeter per fetch aus Admin-Portal / Datenbank ersetzen.
 */
export type PricingConfig = {
  setupFee: number
  pricePerGramPLA: number
  densityPLA: number
  /** Aufschlag pro zusaetzlicher Farbe (ab der 2.), in Prozent vom Basis-Stueckpreis */
  multiColorSurchargePercentPerExtra: number
}

/** Standardwerte — Faktoren passend zur Referenzberechnung (z. B. 3192.9 g → CHF 212.86). */
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  setupFee: 5.0,
  pricePerGramPLA: 0.0666,
  densityPLA: 1.24,
  multiColorSurchargePercentPerExtra: 15,
}
