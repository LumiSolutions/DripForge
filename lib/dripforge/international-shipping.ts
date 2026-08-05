/**
 * Auslandsversand-Steuerung (Admin Finanz-Setup → Checkout / FAQ).
 * Domestic = Schweiz & Liechtenstein.
 */

export const DEFAULT_INTERNATIONAL_DISABLED_MESSAGE =
  "Aktuell sind leider keine Auslandsbestellungen möglich. Wir liefern derzeit nur innerhalb der Schweiz & Lichtenstein."

export type InternationalShippingSettings = {
  /** Wenn false: Auslandsadressen im Checkout blockieren */
  allowInternationalOrders: boolean
  /** Hinweistext bei Deaktivierung (Checkout + FAQ) */
  disabledMessage: string
  /** Pauschale Versandkosten EU (CHF), wenn Auslandsversand aktiv */
  euFlatRateChf: number
  /** Pauschale Versandkosten Rest der Welt (CHF) */
  worldFlatRateChf: number
}

export const DEFAULT_INTERNATIONAL_SHIPPING: InternationalShippingSettings = {
  allowInternationalOrders: false,
  disabledMessage: DEFAULT_INTERNATIONAL_DISABLED_MESSAGE,
  euFlatRateChf: 18,
  worldFlatRateChf: 35,
}

const DOMESTIC_ALIASES = new Set([
  "ch",
  "switzerland",
  "schweiz",
  "suisse",
  "svizzera",
  "li",
  "liechtenstein",
  "lichtenstein", // häufige Schreibweise / Default-Hinweis
])

const EU_COUNTRY_ALIASES = new Set([
  "at",
  "austria",
  "österreich",
  "oesterreich",
  "de",
  "germany",
  "deutschland",
  "fr",
  "france",
  "frankreich",
  "it",
  "italy",
  "italien",
  "be",
  "belgium",
  "belgien",
  "nl",
  "netherlands",
  "niederlande",
  "holland",
  "es",
  "spain",
  "spanien",
  "pt",
  "portugal",
  "ie",
  "ireland",
  "irland",
  "fi",
  "finland",
  "finnland",
  "se",
  "sweden",
  "schweden",
  "dk",
  "denmark",
  "dänemark",
  "daenemark",
  "pl",
  "poland",
  "polen",
  "cz",
  "czechia",
  "tschechien",
  "sk",
  "slovakia",
  "slowakei",
  "hu",
  "hungary",
  "ungarn",
  "ro",
  "romania",
  "rumänien",
  "rumaenien",
  "bg",
  "bulgaria",
  "bulgarien",
  "hr",
  "croatia",
  "kroatien",
  "si",
  "slovenia",
  "slowenien",
  "ee",
  "estonia",
  "estland",
  "lv",
  "latvia",
  "lettland",
  "lt",
  "lithuania",
  "litauen",
  "lu",
  "luxembourg",
  "luxemburg",
  "mt",
  "malta",
  "cy",
  "cyprus",
  "zypern",
  "gr",
  "greece",
  "griechenland",
  "eu",
])

function normalizeCountryKey(country: string | null | undefined): string {
  return String(country ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function isDomesticCountry(country: string | null | undefined): boolean {
  const key = normalizeCountryKey(country)
  if (!key) return true // leer → wie CH behandeln (Default Schweiz)
  if (DOMESTIC_ALIASES.has(key)) return true
  // Kurzcodes am Anfang
  const token = key.split(" ")[0] ?? key
  return DOMESTIC_ALIASES.has(token)
}

export function isEuCountry(country: string | null | undefined): boolean {
  if (isDomesticCountry(country)) return false
  const key = normalizeCountryKey(country)
  if (!key) return false
  if (EU_COUNTRY_ALIASES.has(key)) return true
  const token = key.split(" ")[0] ?? key
  return EU_COUNTRY_ALIASES.has(token)
}

export function normalizeInternationalShipping(
  input?: Partial<InternationalShippingSettings> | null
): InternationalShippingSettings {
  const defaults = DEFAULT_INTERNATIONAL_SHIPPING
  const msg =
    typeof input?.disabledMessage === "string" && input.disabledMessage.trim()
      ? input.disabledMessage.trim().slice(0, 500)
      : defaults.disabledMessage
  const eu = Number(input?.euFlatRateChf)
  const world = Number(input?.worldFlatRateChf)
  return {
    allowInternationalOrders: input?.allowInternationalOrders === true,
    disabledMessage: msg,
    euFlatRateChf:
      Number.isFinite(eu) && eu >= 0
        ? Math.round(eu * 100) / 100
        : defaults.euFlatRateChf,
    worldFlatRateChf:
      Number.isFinite(world) && world >= 0
        ? Math.round(world * 100) / 100
        : defaults.worldFlatRateChf,
  }
}

/** Versandkosten für eine Lieferadresse (null = domestic → normale Staffeln nutzen). */
export function resolveInternationalShippingCost(
  settings: InternationalShippingSettings,
  country: string | null | undefined
): { blocked: boolean; isInternational: boolean; priceChf: number | null; message: string | null } {
  const international = !isDomesticCountry(country)
  if (!international) {
    return {
      blocked: false,
      isInternational: false,
      priceChf: null,
      message: null,
    }
  }
  if (!settings.allowInternationalOrders) {
    return {
      blocked: true,
      isInternational: true,
      priceChf: null,
      message: settings.disabledMessage,
    }
  }
  const priceChf = isEuCountry(country)
    ? settings.euFlatRateChf
    : settings.worldFlatRateChf
  return {
    blocked: false,
    isInternational: true,
    priceChf,
    message: null,
  }
}

export function buildInternationalFaqAnswer(
  settings: InternationalShippingSettings
): { question: string; answer: string } {
  const question = "Liefert ihr auch ins Ausland?"
  if (!settings.allowInternationalOrders) {
    return { question, answer: settings.disabledMessage }
  }
  return {
    question,
    answer: `Ja, wir liefern auch ins Ausland. Versandpauschale EU: CHF ${settings.euFlatRateChf.toFixed(2)}. International (ausserhalb EU): CHF ${settings.worldFlatRateChf.toFixed(2)}. Innerhalb der Schweiz und Liechtenstein gelten die normalen Versandstaffeln.`,
  }
}
