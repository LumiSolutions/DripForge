export const SWISS_VAT_RATE = 0.081

/** Laufzeit-Konfiguration – spaeter aus Admin-DB befuellen */
export type CheckoutRuntimeConfig = {
  mwstAktiv: boolean
  mwstSatz: number
  twintGatewayAktiv: boolean
  twintTelefonnummer: string
}

/** Standard: Kleinunternehmer-Modus (keine MwSt., manuelles TWINT) */
export const DEFAULT_CHECKOUT_RUNTIME_CONFIG: CheckoutRuntimeConfig = {
  mwstAktiv: false,
  mwstSatz: 8.1,
  twintGatewayAktiv: false,
  twintTelefonnummer: "+41 79 000 00 00",
}

export type ShippingMethodId = "apost" | "bpost" | "pickup"

export type PaymentMethodId = "card" | "twint" | "invoice"

export const SHIPPING_OPTIONS: {
  id: ShippingMethodId
  label: string
  price: number
}[] = [
  { id: "apost", label: "A-Post", price: 9 },
  { id: "bpost", label: "B-Post", price: 7 },
  { id: "pickup", label: "Abholung in Pfäffikon ZH", price: 0 },
]

export const PAYMENT_OPTIONS: {
  id: PaymentMethodId
  label: string
  description: string
}[] = [
  {
    id: "card",
    label: "Kreditkarte (Stripe)",
    description:
      "Visa, Mastercard, American Express, Apple Pay, Google Pay via Stripe",
  },
  {
    id: "twint",
    label: "TWINT",
    description: "Bezahlung per TWINT-App via Stripe Checkout",
  },
  {
    id: "invoice",
    label: "Kauf auf Rechnung",
    description: "Zahlung innerhalb von 30 Tagen",
  },
]

export function getTwintPaymentDescription(
  config: Pick<CheckoutRuntimeConfig, "twintGatewayAktiv">,
  options?: { stripeConfigured?: boolean }
): string {
  if (options?.stripeConfigured) {
    return "Sicher bezahlen per TWINT-App via Stripe Checkout"
  }
  return config.twintGatewayAktiv
    ? "TWINT via Stripe (Gateway noch nicht konfiguriert — bitte Stripe-Keys setzen)"
    : "Manuelle Überweisung an unsere TWINT-Nummer"
}

export function calculateCheckoutTotals(
  subtotal: number,
  shippingCost: number,
  config: Pick<CheckoutRuntimeConfig, "mwstAktiv" | "mwstSatz"> = DEFAULT_CHECKOUT_RUNTIME_CONFIG
) {
  const taxable = subtotal + shippingCost
  const vatRate = config.mwstAktiv ? config.mwstSatz / 100 : 0
  const vat = taxable * vatRate
  const total = taxable + vat

  return {
    subtotal,
    shippingCost,
    vat,
    vatRate,
    total,
    mwstAktiv: config.mwstAktiv,
  }
}

export function getShippingCost(method: ShippingMethodId): number {
  return SHIPPING_OPTIONS.find((o) => o.id === method)?.price ?? 0
}
