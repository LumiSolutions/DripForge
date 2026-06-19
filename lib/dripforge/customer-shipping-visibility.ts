/** Sichtbarkeit der Kunden-Einsendung — nur wenn Admin-Toggle aktiv ist. */
export function isCustomerShippingOptionEnabled(
  allowCustomerShipping: boolean
): boolean {
  return allowCustomerShipping
}
