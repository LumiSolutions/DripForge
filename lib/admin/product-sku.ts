import type { AdminProduct } from "@/lib/admin/types"

/** Startwert für fortlaufende Artikelnummern. */
export const PRODUCT_SKU_START = 10001

export function normalizeProductSku(value: unknown): string | undefined {
  if (value == null) return undefined
  const raw = String(value).trim()
  if (!raw) return undefined
  // Rein numerisch, max. 12 Stellen
  if (!/^\d{1,12}$/.test(raw)) return undefined
  return raw
}

function parseSkuNumber(sku: string | undefined | null): number | null {
  const normalized = normalizeProductSku(sku)
  if (!normalized) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** Nächste freie fortlaufende SKU basierend auf vorhandenen Produkten. */
export function allocateNextProductSku(products: AdminProduct[]): string {
  let max = PRODUCT_SKU_START - 1
  for (const product of products) {
    const n = parseSkuNumber(product.sku)
    if (n != null && n > max) max = n
  }
  return String(max + 1)
}
