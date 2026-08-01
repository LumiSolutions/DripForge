import type { Product, ProductShopVariant } from "@/lib/dripforge/types"

export function createShopVariantId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `sv-${slug || "variant"}-${Math.random().toString(36).slice(2, 7)}`
}

export function normalizeShopVariants(raw: unknown): ProductShopVariant[] {
  if (!Array.isArray(raw)) return []
  const out: ProductShopVariant[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue
    const row = entry as Record<string, unknown>
    const name = String(row.name ?? "").trim()
    if (!name) continue
    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : createShopVariantId(name)
    const price =
      row.price != null && Number.isFinite(Number(row.price))
        ? Math.round(Math.max(0, Number(row.price)) * 100) / 100
        : undefined
    const priceDelta =
      row.priceDelta != null && Number.isFinite(Number(row.priceDelta))
        ? Math.round(Number(row.priceDelta) * 100) / 100
        : undefined
    const modellDateiUrl =
      typeof row.modellDateiUrl === "string" && row.modellDateiUrl.trim()
        ? row.modellDateiUrl.trim()
        : undefined
    out.push({ id, name, price, priceDelta, modellDateiUrl })
  }
  return out
}

export function resolveProductShopVariants(product: Product): ProductShopVariant[] {
  return normalizeShopVariants(product.shopVariants)
}

export function productHasShopVariants(product: Product): boolean {
  return resolveProductShopVariants(product).length > 0
}
