import type { Product, ProductDimensionsMm } from "@/lib/dripforge/types"

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function safeDimensions(
  raw: ProductDimensionsMm | undefined | null
): ProductDimensionsMm | undefined {
  if (!raw) return undefined
  const length = safeNumber(raw.length, 0)
  const width = safeNumber(raw.width, 0)
  const height = safeNumber(raw.height, 0)
  if (length <= 0 && width <= 0 && height <= 0) return undefined
  return {
    length: length > 0 ? length : 100,
    width: width > 0 ? width : 100,
    height: height > 0 ? height : 100,
  }
}

function safeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
  return items.length > 0 ? items : undefined
}

/** Storefront: fehlende oder unvollstaendige Cosmos-Felder abfangen. */
export function normalizeShopProduct(raw: Partial<Product> & { id?: string }): Product {
  const price = safeNumber(raw.price, 0)
  const originalRaw = raw.originalPrice
  const originalPrice =
    originalRaw != null && Number.isFinite(Number(originalRaw))
      ? Number(originalRaw)
      : null

  const galerieBilder = safeStringArray(raw.galerieBilder)
  const images = safeStringArray(raw.images) ?? galerieBilder

  const modellDateiUrl = raw.modellDateiUrl?.trim() || raw.modelUrl?.trim() || undefined

  return {
    id: String(raw.id ?? "").trim() || "unknown",
    name: raw.name?.trim() || "Produkt",
    description: raw.description?.trim() || "",
    price,
    originalPrice,
    type: raw.type === "laser" ? "laser" : "3d",
    sale: Boolean(raw.sale),
    basisPreis:
      raw.basisPreis != null && Number.isFinite(Number(raw.basisPreis))
        ? Number(raw.basisPreis)
        : undefined,
    saleRabattTyp: raw.saleRabattTyp,
    saleRabattWert:
      raw.saleRabattWert != null && Number.isFinite(Number(raw.saleRabattWert))
        ? Number(raw.saleRabattWert)
        : undefined,
    laserMaterialId: raw.laserMaterialId,
    modelUrl: modellDateiUrl,
    modellDateiUrl,
    images,
    galerieBilder: galerieBilder ?? images,
    dimensionsMm: safeDimensions(raw.dimensionsMm),
    volumen:
      raw.volumen != null && Number.isFinite(Number(raw.volumen))
        ? Number(raw.volumen)
        : undefined,
    volumenEinheit: raw.volumenEinheit === "mm3" ? "mm3" : "cm3",
    gewicht:
      raw.gewicht != null && Number.isFinite(Number(raw.gewicht))
        ? Number(raw.gewicht)
        : undefined,
    varianten: safeStringArray(raw.varianten),
    istAktiv: raw.istAktiv !== false,
    individualisierungsBild: raw.individualisierungsBild?.trim() || undefined,
  }
}

export function normalizeShopProducts(
  products: Array<Partial<Product> & { id?: string }>
): Product[] {
  return products.map((product) => normalizeShopProduct(product))
}
