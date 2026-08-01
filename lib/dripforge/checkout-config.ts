export const SWISS_VAT_RATE = 0.081

/** Laufzeit-Konfiguration – spaeter aus Admin-DB befuellen */
export type CheckoutRuntimeConfig = {
  mwstAktiv: boolean
  /** Schweizer Normalsteuersatz in % — Laufzeit-Default, nicht mehr global im Admin editierbar */
  mwstSatz: number
  /** MwSt.-Nummer (UID), z. B. CHE-123.456.789 MWST — relevant wenn mwstAktiv */
  mwstNummer?: string
  twintGatewayAktiv: boolean
  twintTelefonnummer: string
}

/** Standard: Kleinunternehmer-Modus (keine MwSt., manuelles TWINT) */
export const DEFAULT_CHECKOUT_RUNTIME_CONFIG: CheckoutRuntimeConfig = {
  mwstAktiv: false,
  mwstSatz: 8.1,
  mwstNummer: "",
  twintGatewayAktiv: false,
  twintTelefonnummer: "+41 79 000 00 00",
}

export function normalizeCheckoutRuntimeConfig(
  input?: Partial<CheckoutRuntimeConfig> | null
): CheckoutRuntimeConfig {
  const mwstSatzRaw = Number(input?.mwstSatz)
  return {
    mwstAktiv: Boolean(input?.mwstAktiv),
    mwstSatz:
      Number.isFinite(mwstSatzRaw) && mwstSatzRaw >= 0
        ? mwstSatzRaw
        : DEFAULT_CHECKOUT_RUNTIME_CONFIG.mwstSatz,
    mwstNummer:
      typeof input?.mwstNummer === "string" ? input.mwstNummer.trim() : "",
    twintGatewayAktiv: Boolean(input?.twintGatewayAktiv),
    twintTelefonnummer:
      typeof input?.twintTelefonnummer === "string" &&
      input.twintTelefonnummer.trim()
        ? input.twintTelefonnummer.trim()
        : DEFAULT_CHECKOUT_RUNTIME_CONFIG.twintTelefonnummer,
  }
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
      "Nach «Jetzt bezahlen» öffnet sich die sichere Stripe-Seite mit Kartenfeldern, Apple Pay und Google Pay (kein Inline-Formular auf dieser Seite).",
  },
  {
    id: "twint",
    label: "TWINT",
    description: "Bezahlung per offiziellem TWINT-Zahlungslink",
  },
  {
    id: "invoice",
    label: "Kauf auf Rechnung",
    description: "Zahlung innerhalb von 30 Tagen",
  },
]

export function getTwintPaymentDescription(
  config: Pick<CheckoutRuntimeConfig, "twintGatewayAktiv">,
  options?: { stripeConfigured?: boolean; twintPaymentLinkConfigured?: boolean }
): string {
  if (options?.twintPaymentLinkConfigured) {
    return "Nach dem Absenden öffnest du den offiziellen TWINT-Zahlungslink und bezahlst in der TWINT-App"
  }
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
