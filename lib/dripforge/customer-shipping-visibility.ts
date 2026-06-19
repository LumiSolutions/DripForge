/** Produktions-Schalter: Kunden-Einsendung im Frontend erst nach expliziter Freigabe. */
export const CUSTOMER_SHIPPING_UI_ENABLED = false

export function isCustomerShippingUiVisible(allowCustomerShipping: boolean): boolean {
  if (!allowCustomerShipping) return false
  if (process.env.NODE_ENV === "development") return true
  return CUSTOMER_SHIPPING_UI_ENABLED
}
