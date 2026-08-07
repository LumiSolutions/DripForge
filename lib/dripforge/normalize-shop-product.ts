import type { Product, ProductDimensionsMm } from "@/lib/dripforge/types"
import { normalizeProductImageShape } from "@/lib/dripforge/types"
import { normalizeShopVariants } from "@/lib/dripforge/product-shop-variants"
import { PRODUCT_DOC_TYPE } from "@/lib/cosmos/products-container"
import { normalizeProductTagIds } from "@/lib/admin/product-tags"
import { NEUTRAL_PRODUCT_PLACEHOLDER } from "@/lib/dripforge/neutral-placeholder"
import { normalizeQuantityDiscountTiers } from "@/lib/dripforge/quantity-discount-tiers"
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  normalizeLowStockThreshold,
  normalizeManualAvailability,
  normalizeStockQuantity,
  normalizeZeroStockBehavior,
} from "@/lib/dripforge/product-inventory"

const PLACEHOLDER_IMAGE = NEUTRAL_PRODUCT_PLACEHOLDER

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function extractImageUrl(entry: unknown): string | null {
  if (typeof entry === "string") {
    const trimmed = entry.trim()
    return trimmed || null
  }
  if (entry && typeof entry === "object") {
    const record = entry as Record<string, unknown>
    for (const key of ["url", "src", "href", "path"] as const) {
      const candidate = record[key]
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim()
      }
    }
  }
  return null
}

function safeImageArray(value: unknown): string[] | undefined {
  if (!value) return undefined
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : undefined
  }
  if (!Array.isArray(value)) return undefined
  const items = value
    .map((entry) => extractImageUrl(entry))
    .filter((entry): entry is string => Boolean(entry))
  return items.length > 0 ? items : undefined
}

function safeVariantenArray(value: unknown): string[] | undefined {
  if (typeof value === "string") {
    const items = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
    return items.length > 0 ? items : undefined
  }
  if (!Array.isArray(value)) return undefined
  const items = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
  return items.length > 0 ? items : undefined
}

function readDimensionAxis(raw: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = raw[key]
    if (value != null) {
      const n = safeNumber(value, 0)
      if (n > 0) return n
    }
  }
  return 0
}

function safeDimensions(raw: unknown): ProductDimensionsMm | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const record = raw as Record<string, unknown>
  const length = readDimensionAxis(record, ["length", "länge", "l", "x"])
  const width = readDimensionAxis(record, ["width", "breite", "w", "y"])
  const height = readDimensionAxis(record, ["height", "höhe", "h", "z"])
  if (length <= 0 && width <= 0 && height <= 0) return undefined
  return {
    length: length > 0 ? length : 100,
    width: width > 0 ? width : 100,
    height: height > 0 ? height : 100,
  }
}

function safeRotationDeg(
  raw: unknown
): { x: number; y: number; z: number } | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const r = raw as { x?: unknown; y?: unknown; z?: unknown }
  const norm = (value: unknown): number => {
    const n = Number(value)
    if (!Number.isFinite(n)) return 0
    return ((Math.round(n) % 360) + 360) % 360
  }
  const rot = { x: norm(r.x), y: norm(r.y), z: norm(r.z) }
  if (rot.x === 0 && rot.y === 0 && rot.z === 0) return undefined
  return rot
}

function inferIdFromMediaUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const match = url.match(/\/product-media\/([^/]+)\//i)
  return match?.[1]?.trim() || undefined
}

function resolveProductId(raw: Record<string, unknown>): string {
  const direct = String(raw.id ?? "").trim()
  if (direct) return direct

  const modelUrl = String(raw.modellDateiUrl ?? raw.modelUrl ?? "").trim()
  const fromModel = inferIdFromMediaUrl(modelUrl)
  if (fromModel) return fromModel

  const gallery = safeImageArray(raw.galerieBilder ?? raw.images)
  if (gallery?.[0]) {
    const fromGallery = inferIdFromMediaUrl(gallery[0])
    if (fromGallery) return fromGallery
  }

  return "unknown"
}

export function isShopProductDocument(
  raw: Record<string, unknown> | null | undefined
): boolean {
  if (!raw?.id && !raw?.name) return false
  if (raw.id === "global") return false
  if (raw.docType != null && raw.docType !== PRODUCT_DOC_TYPE) return false
  return true
}

/** Storefront: fehlende oder unvollständige Cosmos-Felder abfangen. */
export function normalizeShopProduct(
  raw: Partial<Product> & { id?: string; docType?: string; dimensions?: unknown }
): Product {
  try {
    const source = (raw ?? {}) as Record<string, unknown>
    if (!isShopProductDocument(source)) {
      console.warn("Shop: Ungültiges Produkt-Dokument ignoriert.", source)
    }

    const price = safeNumber(source.price, 0)
    const originalRaw = source.originalPrice
    const originalPrice =
      originalRaw != null && Number.isFinite(Number(originalRaw))
        ? Number(originalRaw)
        : null

    const galerieBilder = safeImageArray(source.galerieBilder)
    const images = safeImageArray(source.images) ?? galerieBilder

    const modellDateiUrl =
      (typeof source.modellDateiUrl === "string" ? source.modellDateiUrl.trim() : "") ||
      (typeof source.modelUrl === "string" ? source.modelUrl.trim() : "") ||
      undefined

    const dimensionsMm =
      safeDimensions(source.dimensionsMm) ??
      safeDimensions(source.dimensions) ??
      safeDimensions(source.masse)

    const defaultRotationDeg = safeRotationDeg(source.defaultRotationDeg)

    return {
      id: resolveProductId(source),
      name:
        (typeof source.name === "string" && source.name.trim()) ||
        "Unbekanntes Produkt",
      description:
        (typeof source.description === "string" && source.description.trim()) || "",
      price,
      originalPrice,
      type: source.type === "laser" ? "laser" : "3d",
      sale: Boolean(source.sale),
      basisPreis:
        source.basisPreis != null && Number.isFinite(Number(source.basisPreis))
          ? Number(source.basisPreis)
          : undefined,
      saleRabattTyp:
        source.saleRabattTyp === "percent" || source.saleRabattTyp === "fixed"
          ? source.saleRabattTyp
          : undefined,
      saleRabattWert:
        source.saleRabattWert != null && Number.isFinite(Number(source.saleRabattWert))
          ? Number(source.saleRabattWert)
          : undefined,
      laserMaterialId:
        typeof source.laserMaterialId === "string" &&
        source.laserMaterialId.trim()
          ? source.laserMaterialId.trim()
          : undefined,
      modelUrl: modellDateiUrl,
      modellDateiUrl,
      images: images ?? [PLACEHOLDER_IMAGE],
      galerieBilder: galerieBilder ?? images ?? [PLACEHOLDER_IMAGE],
      dimensionsMm,
      defaultRotationDeg,
      volumen:
        source.volumen != null && Number.isFinite(Number(source.volumen))
          ? Number(source.volumen)
          : undefined,
      volumenEinheit: source.volumenEinheit === "mm3" ? "mm3" : "cm3",
      gewicht:
        source.gewicht != null && Number.isFinite(Number(source.gewicht))
          ? Number(source.gewicht)
          : undefined,
      varianten: safeVariantenArray(source.varianten),
      shopVariants: normalizeShopVariants(source.shopVariants),
      istAktiv: source.istAktiv !== false,
      isTopProduct: Boolean(source.isTopProduct),
      individualisierungsBild:
        typeof source.individualisierungsBild === "string"
          ? source.individualisierungsBild.trim() || undefined
          : undefined,
      createdAt:
        typeof source.createdAt === "string" && source.createdAt.trim()
          ? source.createdAt.trim()
          : undefined,
      tags: normalizeProductTagIds(source.tags),
      limitedEdition: Boolean(source.limitedEdition),
      seasonalEventId:
        typeof source.seasonalEventId === "string" && source.seasonalEventId.trim()
          ? source.seasonalEventId.trim()
          : null,
      seasonalUrgencyText:
        typeof source.seasonalUrgencyText === "string" &&
        source.seasonalUrgencyText.trim()
          ? source.seasonalUrgencyText.trim()
          : null,
      imageShape: normalizeProductImageShape(source.imageShape),
      sku:
        typeof source.sku === "string" && source.sku.trim()
          ? source.sku.trim()
          : undefined,
      defaultFilamentColorId:
        typeof source.defaultFilamentColorId === "string"
          ? source.defaultFilamentColorId.trim() || null
          : source.defaultFilamentColorId === null
            ? null
            : undefined,
      defaultFilamentColorName:
        typeof source.defaultFilamentColorName === "string"
          ? source.defaultFilamentColorName.trim() || null
          : source.defaultFilamentColorName === null
            ? null
            : undefined,
      multiColorEnabled: Boolean(source.multiColorEnabled),
      partLabels: Array.isArray(source.partLabels)
        ? source.partLabels
            .map((label) => (typeof label === "string" ? label.trim() : ""))
            .filter(Boolean)
            .slice(0, 24)
        : undefined,
      quantityDiscountTiers: (() => {
        const tiers = normalizeQuantityDiscountTiers(source.quantityDiscountTiers)
        return tiers.length > 0 ? tiers : undefined
      })(),
      printTimeMinutes: (() => {
        const n = Math.round(Number(source.printTimeMinutes))
        return Number.isFinite(n) && n > 0 ? n : undefined
      })(),
      printTimeShowInShop: Boolean(source.printTimeShowInShop),
      allowedFilamentMaterialTypeIds: (() => {
        if (!("allowedFilamentMaterialTypeIds" in source)) return undefined
        if (!Array.isArray(source.allowedFilamentMaterialTypeIds)) {
          return undefined
        }
        const ids = source.allowedFilamentMaterialTypeIds
          .map((id) => (typeof id === "string" ? id.trim().toLowerCase() : ""))
          .filter(Boolean)
        return ids
      })(),
      trackInventory: Boolean(source.trackInventory),
      stockQuantity: normalizeStockQuantity(source.stockQuantity ?? 0),
      lowStockThreshold: normalizeLowStockThreshold(
        source.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD
      ),
      manualAvailability: normalizeManualAvailability(source.manualAvailability),
      zeroStockBehavior: normalizeZeroStockBehavior(source.zeroStockBehavior),
    }
  } catch (error) {
    console.error("Shop: normalizeShopProduct fehlgeschlagen.", error, raw)
    return {
      id: "unknown",
      name: "Unbekanntes Produkt",
      description: "",
      price: 0,
      originalPrice: null,
      type: "3d",
      sale: false,
      images: [PLACEHOLDER_IMAGE],
      galerieBilder: [PLACEHOLDER_IMAGE],
      tags: [],
      istAktiv: true,
      isTopProduct: false,
    }
  }
}

export function normalizeShopProducts(
  products: Array<Partial<Product> & { id?: string }>
): Product[] {
  return products.map((product) => normalizeShopProduct(product))
}
