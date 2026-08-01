export const INDIVIDUAL_PRICING_DOC_ID = "individual-pricing-settings"
export const INDIVIDUAL_PRICING_DOC_TYPE = "individual-pricing-settings"

export type IndividualPricingCategory = {
  id: string
  label: string
  sizeHint: string
  fromPriceChf: number
  sortOrder: number
}

export type IndividualServicePricing = {
  categories: IndividualPricingCategory[]
  footnote: string
}

export type IndividualPricingSettings = {
  print3d: IndividualServicePricing
  laser: IndividualServicePricing
  updatedAt: string
}

export const DEFAULT_PRICING_FOOTNOTE =
  "Der endgültige Preis richtet sich nach Materialverbrauch, Druckzeit, Nachbearbeitung und Komplexität des Modells. Für grössere Projekte erstellen wir eine unverbindliche Offerte."

export function createDefaultPrint3dCategories(): IndividualPricingCategory[] {
  return [
    {
      id: "print-cat-1",
      label: "Kat. 1",
      sizeHint: "klein bis 10 cm",
      fromPriceChf: 14.99,
      sortOrder: 0,
    },
    {
      id: "print-cat-2",
      label: "Kat. 2",
      sizeHint: "mittel 10-20 cm",
      fromPriceChf: 24.99,
      sortOrder: 1,
    },
    {
      id: "print-cat-3",
      label: "Kat. 3",
      sizeHint: "gross 20-30 cm",
      fromPriceChf: 34.99,
      sortOrder: 2,
    },
  ]
}

export function createDefaultLaserCategories(): IndividualPricingCategory[] {
  return [
    {
      id: "laser-cat-1",
      label: "Kat. 1",
      sizeHint: "klein",
      fromPriceChf: 9.99,
      sortOrder: 0,
    },
    {
      id: "laser-cat-2",
      label: "Kat. 2",
      sizeHint: "mittel",
      fromPriceChf: 14.99,
      sortOrder: 1,
    },
    {
      id: "laser-cat-3",
      label: "Kat. 3",
      sizeHint: "gross",
      fromPriceChf: 24.99,
      sortOrder: 2,
    },
  ]
}

export function createDefaultIndividualPricingSettings(): IndividualPricingSettings {
  return {
    print3d: {
      categories: createDefaultPrint3dCategories(),
      footnote: DEFAULT_PRICING_FOOTNOTE,
    },
    laser: {
      categories: createDefaultLaserCategories(),
      footnote: DEFAULT_PRICING_FOOTNOTE,
    },
    updatedAt: new Date().toISOString(),
  }
}

function sanitizeCategory(
  input: Partial<IndividualPricingCategory> | null | undefined,
  fallback: IndividualPricingCategory,
  index: number
): IndividualPricingCategory {
  const price = Number(input?.fromPriceChf)
  return {
    id: String(input?.id ?? fallback.id).trim() || fallback.id,
    label: String(input?.label ?? fallback.label).trim() || fallback.label,
    sizeHint: String(input?.sizeHint ?? fallback.sizeHint).trim() || fallback.sizeHint,
    fromPriceChf:
      Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : fallback.fromPriceChf,
    sortOrder:
      Number.isFinite(Number(input?.sortOrder))
        ? Math.max(0, Math.round(Number(input?.sortOrder)))
        : index,
  }
}

function sanitizeServicePricing(
  input: Partial<IndividualServicePricing> | null | undefined,
  defaults: IndividualServicePricing
): IndividualServicePricing {
  const rawCats = Array.isArray(input?.categories) ? input.categories : null
  const categories =
    rawCats && rawCats.length > 0
      ? rawCats
          .slice(0, 3)
          .map((cat, index) =>
            sanitizeCategory(cat, defaults.categories[index] ?? defaults.categories[0]!, index)
          )
      : defaults.categories.map((c) => ({ ...c }))

  while (categories.length < 3) {
    const fallback = defaults.categories[categories.length]!
    categories.push({ ...fallback })
  }

  return {
    categories: categories
      .slice(0, 3)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "de")),
    footnote: String(input?.footnote ?? defaults.footnote).trim() || defaults.footnote,
  }
}

export function sanitizeIndividualPricingSettings(
  input: Partial<IndividualPricingSettings> | null | undefined
): IndividualPricingSettings {
  const defaults = createDefaultIndividualPricingSettings()
  if (!input) return defaults
  return {
    print3d: sanitizeServicePricing(input.print3d, defaults.print3d),
    laser: sanitizeServicePricing(input.laser, defaults.laser),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
}

export function mergeIndividualPricingSettings(
  stored: Partial<IndividualPricingSettings> | null | undefined
): IndividualPricingSettings {
  if (!stored) return createDefaultIndividualPricingSettings()
  return sanitizeIndividualPricingSettings(stored)
}

export function formatFromPriceChf(price: number): string {
  return `ab CHF ${Number(price).toFixed(2)}`
}
