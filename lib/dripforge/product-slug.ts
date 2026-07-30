/** Produkt-Slugs für /produkt/[slug] — stabil über Reloads. */

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
 * URL-Slug: `{name-slug}--{productId}`
 * Doppel-Bindestrich trennt lesbaren Namen von der stabilen ID.
 */
export function getProductSlug(product: { id: string; name: string }): string {
  const base = slugifyProductName(product.name) || "produkt"
  return `${base}--${encodeURIComponent(product.id)}`
}

/** Extrahiert die Produkt-ID aus einem Slug (oder akzeptiert reine IDs). */
export function productIdFromSlug(slug: string): string | null {
  const raw = slug.trim()
  if (!raw) return null
  const sep = raw.lastIndexOf("--")
  if (sep >= 0) {
    const id = decodeURIComponent(raw.slice(sep + 2)).trim()
    return id || null
  }
  return decodeURIComponent(raw)
}

export function productHref(product: { id: string; name: string }): string {
  return `/produkt/${getProductSlug(product)}`
}
