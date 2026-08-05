export const SWISS_VAT_RATE = 0.081

/** Laufzeit-Konfiguration aus Admin-Einstellungen */
export type CheckoutRuntimeConfig = {
  mwstAktiv: boolean
  /** Schweizer Normalsteuersatz in % — Laufzeit-Default, nicht mehr global im Admin editierbar */
  mwstSatz: number
  /** MwSt.-Nummer (UID), z. B. CHE-123.456.789 MWST — relevant wenn mwstAktiv */
  mwstNummer?: string
  twintGatewayAktiv: boolean
  twintTelefonnummer: string
  /** Zahlungsarten im Shop-Checkout (Admin-Schalter) */
  paymentCardAktiv: boolean
  paymentTwintAktiv: boolean
  paymentInvoiceAktiv: boolean
  /** Barzahlung bei Abholung (offline, Zahlung vor Ort) */
  paymentCashAktiv: boolean
}

/** Standard: alle Zahlungsarten aktiv; Kleinunternehmer ohne MwSt. */
export const DEFAULT_CHECKOUT_RUNTIME_CONFIG: CheckoutRuntimeConfig = {
  mwstAktiv: false,
  mwstSatz: 8.1,
  mwstNummer: "",
  twintGatewayAktiv: false,
  twintTelefonnummer: "+41 79 000 00 00",
  paymentCardAktiv: true,
  paymentTwintAktiv: true,
  paymentInvoiceAktiv: true,
  // Neue Zahlungsart — standardmässig deaktiviert (Admin aktiviert bei Bedarf).
  paymentCashAktiv: false,
}

function boolOrDefault(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  return fallback
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
    // Fehlende Flags (ältere Settings) → aktiv (Abwärtskompatibilität)
    paymentCardAktiv: boolOrDefault(
      input?.paymentCardAktiv,
      DEFAULT_CHECKOUT_RUNTIME_CONFIG.paymentCardAktiv
    ),
    paymentTwintAktiv: boolOrDefault(
      input?.paymentTwintAktiv,
      DEFAULT_CHECKOUT_RUNTIME_CONFIG.paymentTwintAktiv
    ),
    paymentInvoiceAktiv: boolOrDefault(
      input?.paymentInvoiceAktiv,
      DEFAULT_CHECKOUT_RUNTIME_CONFIG.paymentInvoiceAktiv
    ),
    paymentCashAktiv: boolOrDefault(
      input?.paymentCashAktiv,
      DEFAULT_CHECKOUT_RUNTIME_CONFIG.paymentCashAktiv
    ),
  }
}

export type ShippingMethodId = "apost" | "bpost" | "pickup" | "brief"

export type PaymentMethodId = "card" | "twint" | "invoice" | "cash"

export const SHIPPING_OPTIONS: {
  id: ShippingMethodId
  label: string
  price: number
}[] = [
  { id: "brief", label: "Brief", price: 2 },
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
  {
    id: "cash",
    label: "Barzahlung bei Abholung",
    description: "Zahlung in bar vor Ort bei der Abholung",
  },
]

export function isPaymentMethodEnabled(
  method: PaymentMethodId,
  config: Pick<
    CheckoutRuntimeConfig,
    "paymentCardAktiv" | "paymentTwintAktiv" | "paymentInvoiceAktiv" | "paymentCashAktiv"
  >
): boolean {
  switch (method) {
    case "card":
      return config.paymentCardAktiv
    case "twint":
      return config.paymentTwintAktiv
    case "invoice":
      return config.paymentInvoiceAktiv
    case "cash":
      return config.paymentCashAktiv
    default:
      return false
  }
}

export function getEnabledPaymentOptions(
  config: Pick<
    CheckoutRuntimeConfig,
    "paymentCardAktiv" | "paymentTwintAktiv" | "paymentInvoiceAktiv" | "paymentCashAktiv"
  >
): typeof PAYMENT_OPTIONS {
  return PAYMENT_OPTIONS.filter((option) =>
    isPaymentMethodEnabled(option.id, config)
  )
}

/**
 * Checkout-Zahlungsarten unter Berücksichtigung der Kundenkategorie.
 * - Keine Kategorie / leere Allowlist → global aktivierte Methoden.
 * - Nicht-leere Allowlist → exklusiv diese Methoden (auch wenn global deaktiviert),
 *   damit z. B. «Personal» Stripe/Barzahlung testen kann.
 */
export function getPaymentOptionsForCategory(
  config: Pick<
    CheckoutRuntimeConfig,
    "paymentCardAktiv" | "paymentTwintAktiv" | "paymentInvoiceAktiv" | "paymentCashAktiv"
  >,
  allowedPaymentMethodIds?: PaymentMethodId[] | null
): typeof PAYMENT_OPTIONS {
  const allowed = Array.isArray(allowedPaymentMethodIds)
    ? allowedPaymentMethodIds.filter((id): id is PaymentMethodId =>
        PAYMENT_OPTIONS.some((o) => o.id === id)
      )
    : []
  if (allowed.length === 0) return getEnabledPaymentOptions(config)
  return PAYMENT_OPTIONS.filter((option) => allowed.includes(option.id))
}

/**
 * Server/Checkout: Zahlungsart erlaubt?
 * Kategorie-Allowlist überschreibt globale Finanz-Setup-Toggles (z. B. Stripe für Personal).
 */
export function isPaymentMethodAllowedForCheckout(
  methodId: PaymentMethodId,
  config: Pick<
    CheckoutRuntimeConfig,
    "paymentCardAktiv" | "paymentTwintAktiv" | "paymentInvoiceAktiv" | "paymentCashAktiv"
  >,
  allowedPaymentMethodIds?: PaymentMethodId[] | null
): boolean {
  return getPaymentOptionsForCategory(config, allowedPaymentMethodIds).some(
    (option) => option.id === methodId
  )
}

export function getDefaultPaymentMethod(
  config: Pick<
    CheckoutRuntimeConfig,
    "paymentCardAktiv" | "paymentTwintAktiv" | "paymentInvoiceAktiv" | "paymentCashAktiv"
  >
): PaymentMethodId | null {
  return getEnabledPaymentOptions(config)[0]?.id ?? null
}

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
  // Primär über SHIPPING_OPTIONS (inkl. Brief); dynamische Staffeln
  // überschreiben den Preis im Checkout über resolveShippingOptionsForCart.
  return SHIPPING_OPTIONS.find((o) => o.id === method)?.price ?? 0
}
