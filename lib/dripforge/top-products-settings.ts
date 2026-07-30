/** Homepage «Top Produkte»: Sichtbarkeit und Anzahl (Admin → Storefront). */

export const DEFAULT_SHOW_TOP_PRODUCTS_ON_HOMEPAGE = true
export const DEFAULT_TOP_PRODUCTS_COUNT = 4
export const MIN_TOP_PRODUCTS_COUNT = 1
export const MAX_TOP_PRODUCTS_COUNT = 10

export type TopProductsHomepageSettings = {
  /** Sektion «Unsere Top Produkte» auf der Startseite anzeigen */
  showTopProductsOnHomepage: boolean
  /** Anzahl angezeigter Top-Produkte (1–10) */
  topProductsCount: number
}

export function normalizeShowTopProductsOnHomepage(value: unknown): boolean {
  return value !== false
}

export function normalizeTopProductsCount(value: unknown): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return DEFAULT_TOP_PRODUCTS_COUNT
  return Math.min(MAX_TOP_PRODUCTS_COUNT, Math.max(MIN_TOP_PRODUCTS_COUNT, n))
}

export function buildTopProductsHomepageSettings(
  input?: {
    showTopProductsOnHomepage?: unknown
    topProductsCount?: unknown
  } | null
): TopProductsHomepageSettings {
  return {
    showTopProductsOnHomepage: normalizeShowTopProductsOnHomepage(
      input?.showTopProductsOnHomepage
    ),
    topProductsCount: normalizeTopProductsCount(
      input?.topProductsCount ?? DEFAULT_TOP_PRODUCTS_COUNT
    ),
  }
}
