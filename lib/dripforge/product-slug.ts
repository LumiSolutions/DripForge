/** Saubere Produkt-Slugs für /p/[slug] — ohne ID-Anhang. */

import type { Product } from "@/lib/dripforge/types"

export function slugifyProductName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/**
 * Lesbarer Slug ohne ID. Bei Namenskollisionen: herz-kette, herz-kette-2, …
 * (stabile Reihenfolge nach Produkt-ID).
 */
export function getProductSlug(
  product: { id: string; name: string },
  allProducts?: Array<{ id: string; name: string }>
): string {
  const base = slugifyProductName(product.name) || "produkt"
  if (!allProducts || allProducts.length === 0) return base

  const sameName = allProducts
    .filter((p) => slugifyProductName(p.name) === base)
    .sort((a, b) => a.id.localeCompare(b.id))

  if (sameName.length <= 1) return base

  const index = sameName.findIndex((p) => p.id === product.id)
  if (index <= 0) return base
  return `${base}-${index + 1}`
}

export function productHref(
  product: { id: string; name: string },
  allProducts?: Array<{ id: string; name: string }>
): string {
  return `/p/${getProductSlug(product, allProducts)}`
}

/** Legacy: `name--id` oder reine ID. */
export function legacyProductIdFromSlug(slug: string): string | null {
  const raw = slug.trim()
  if (!raw) return null
  const sep = raw.lastIndexOf("--")
  if (sep >= 0) {
    const id = decodeURIComponent(raw.slice(sep + 2)).trim()
    return id || null
  }
  return null
}

export function findProductBySlug(
  slug: string,
  products: Product[]
): Product | null {
  const normalized = slug.trim().toLowerCase()
  if (!normalized || products.length === 0) return null

  // Legacy name--id
  const legacyId = legacyProductIdFromSlug(slug)
  if (legacyId) {
    const byId = products.find((p) => p.id === legacyId)
    if (byId) return byId
  }

  // Exakter Slug-Match (inkl. -2 Kollisions-Suffix)
  for (const product of products) {
    if (getProductSlug(product, products) === normalized) {
      return product
    }
  }

  // Fallback: nur Basis-Name (erster Treffer)
  const baseMatch = products.find(
    (p) => slugifyProductName(p.name) === normalized
  )
  if (baseMatch) return baseMatch

  // Fallback: slug ist die Produkt-ID
  return products.find((p) => p.id === slug.trim()) ?? null
}

/** @deprecated Nutze legacyProductIdFromSlug / findProductBySlug */
export function productIdFromSlug(slug: string): string | null {
  return legacyProductIdFromSlug(slug) ?? (slug.trim() || null)
}
