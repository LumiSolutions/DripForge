import { parseVariantenFromAdmin } from "@/lib/dripforge/product-varianten"
import { normalizeShopVariants } from "@/lib/dripforge/product-shop-variants"
import {
  applySaleToProductFields,
  resolveProductBasisPreis,
  roundChf,
  validateSaleDiscount,
} from "@/lib/dripforge/product-sale"
import type { AdminProduct } from "@/lib/admin/types"
import type { Product } from "@/lib/dripforge/types"
import { normalizeProductTagIds } from "@/lib/admin/product-tags"
import {
  isProductActive,
  isProductShopStatus,
  productFieldsFromShopStatus,
  type ProductShopStatus,
} from "@/lib/admin/product-status"
import { normalizeProductSku } from "@/lib/admin/product-sku"
import { normalizeProductImageShape } from "@/lib/dripforge/types"
import { normalizeQuantityDiscountTiers } from "@/lib/dripforge/quantity-discount-tiers"
import { normalizeAllowedFilamentMaterialTypeIds } from "@/lib/dripforge/product-filament-materials"
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  normalizeLowStockThreshold,
  normalizeManualAvailability,
  normalizeStockQuantity,
  normalizeZeroStockBehavior,
} from "@/lib/dripforge/product-inventory"

export { isProductActive }

export function normalizeAdminProductInput(
  input: Partial<AdminProduct> & {
    variantenText?: string
    basisPreis?: number
    /** Optionaler Kurzstatus — wird auf `istAktiv` / `sale` gemappt */
    status?: ProductShopStatus
  },
  existing?: AdminProduct
): AdminProduct {
  const varianten =
    input.variantenText !== undefined
      ? parseVariantenFromAdmin(input.variantenText)
      : input.varianten ?? existing?.varianten ?? []

  const galerieBilder =
    input.galerieBilder ??
    existing?.galerieBilder ??
    input.images ??
    existing?.images ??
    []

  const modellDateiUrl =
    (input.modellDateiUrl ?? existing?.modellDateiUrl ?? input.modelUrl ?? existing?.modelUrl)?.trim() ||
    undefined

  const individualisierungsBild =
    (input.individualisierungsBild ?? existing?.individualisierungsBild)?.trim() ||
    undefined

  const statusFields = isProductShopStatus(input.status)
    ? productFieldsFromShopStatus(input.status)
    : null

  const istAktiv =
    statusFields != null
      ? statusFields.istAktiv
      : input.istAktiv !== undefined
        ? Boolean(input.istAktiv)
        : existing?.istAktiv !== false

  const isTopProduct =
    input.isTopProduct !== undefined
      ? Boolean(input.isTopProduct)
      : Boolean(existing?.isTopProduct)

  const sale =
    statusFields != null && statusFields.sale !== undefined
      ? statusFields.sale
      : input.sale !== undefined
        ? Boolean(input.sale)
        : Boolean(existing?.sale)

  const basisPreis = roundChf(
    Number(
      input.basisPreis ??
        input.originalPrice ??
        (sale ? existing?.basisPreis ?? existing?.originalPrice : input.price) ??
        existing?.basisPreis ??
        existing?.price ??
        0
    ) || 0
  )

  const saleFields = applySaleToProductFields({
    basisPreis,
    sale,
    saleRabattTyp: input.saleRabattTyp ?? existing?.saleRabattTyp,
    saleRabattWert: input.saleRabattWert ?? existing?.saleRabattWert,
  })

  const purchasePriceChf =
    input.purchasePriceChf != null
      ? roundChf(Math.max(0, Number(input.purchasePriceChf) || 0))
      : existing?.purchasePriceChf != null
        ? roundChf(Math.max(0, Number(existing.purchasePriceChf) || 0))
        : undefined

  const additionalBaseCostChf =
    input.additionalBaseCostChf != null
      ? roundChf(Math.max(0, Number(input.additionalBaseCostChf) || 0))
      : existing?.additionalBaseCostChf != null
        ? roundChf(Math.max(0, Number(existing.additionalBaseCostChf) || 0))
        : undefined

  if (sale) {
    const validation = validateSaleDiscount(
      basisPreis,
      saleFields.saleRabattTyp!,
      saleFields.saleRabattWert!
    )
    if (validation) {
      throw new Error(validation)
    }
  }

  const now = new Date().toISOString()

  const sku =
    normalizeProductSku(input.sku) ??
    normalizeProductSku(existing?.sku)

  return {
    id: input.id ?? existing?.id ?? `p-${Date.now()}`,
    name: input.name?.trim() ?? existing?.name ?? "Neues Produkt",
    description: input.description?.trim() ?? existing?.description ?? "",
    ...(sku ? { sku } : {}),
    ...saleFields,
    purchasePriceChf,
    additionalBaseCostChf,
    type: (input.type ?? existing?.type) === "laser" ? "laser" : "3d",
    istAktiv,
    isTopProduct,
    laserMaterialId: input.laserMaterialId ?? existing?.laserMaterialId,
    galerieBilder,
    individualisierungsBild,
    modellDateiUrl,
    images: galerieBilder,
    modelUrl: modellDateiUrl,
    dimensionsMm: input.dimensionsMm ?? existing?.dimensionsMm,
    defaultRotationDeg: input.defaultRotationDeg ?? existing?.defaultRotationDeg,
    volumen:
      input.volumen != null
        ? Number(input.volumen)
        : existing?.volumen,
    volumenEinheit: input.volumenEinheit ?? existing?.volumenEinheit ?? "cm3",
    gewicht:
      input.gewicht != null
        ? Number(input.gewicht)
        : existing?.gewicht,
    varianten,
    shopVariants: normalizeShopVariants(
      input.shopVariants ?? existing?.shopVariants
    ),
    materialLinks: input.materialLinks ?? existing?.materialLinks ?? [],
    tags: normalizeProductTagIds(input.tags ?? existing?.tags),
    imageShape: normalizeProductImageShape(
      input.imageShape ?? existing?.imageShape
    ),
    defaultFilamentColorId:
      input.defaultFilamentColorId !== undefined
        ? input.defaultFilamentColorId
        : existing?.defaultFilamentColorId ?? null,
    defaultFilamentColorName:
      input.defaultFilamentColorName !== undefined
        ? input.defaultFilamentColorName
        : existing?.defaultFilamentColorName ?? null,
    multiColorEnabled:
      input.multiColorEnabled !== undefined
        ? Boolean(input.multiColorEnabled)
        : Boolean(existing?.multiColorEnabled),
    partLabels: Array.isArray(input.partLabels)
      ? input.partLabels
          .map((label) => String(label ?? "").trim())
          .filter(Boolean)
          .slice(0, 24)
      : Array.isArray(existing?.partLabels)
        ? existing.partLabels
        : undefined,
    quantityDiscountTiers: (() => {
      const tiers = normalizeQuantityDiscountTiers(
        input.quantityDiscountTiers !== undefined
          ? input.quantityDiscountTiers
          : existing?.quantityDiscountTiers
      )
      return tiers.length > 0 ? tiers : undefined
    })(),
    printTimeMinutes: (() => {
      const raw =
        input.printTimeMinutes !== undefined
          ? input.printTimeMinutes
          : existing?.printTimeMinutes
      if (raw == null) return undefined
      const n = Math.round(Number(raw))
      if (!Number.isFinite(n) || n <= 0) return undefined
      return n
    })(),
    printTimeShowInShop: (() => {
      if (input.printTimeShowInShop !== undefined) {
        return Boolean(input.printTimeShowInShop)
      }
      if (existing?.printTimeShowInShop !== undefined) {
        return Boolean(existing.printTimeShowInShop)
      }
      return false
    })(),
    allowedFilamentMaterialTypeIds: (() => {
      if (input.allowedFilamentMaterialTypeIds !== undefined) {
        return normalizeAllowedFilamentMaterialTypeIds(
          input.allowedFilamentMaterialTypeIds
        )
      }
      if (existing?.allowedFilamentMaterialTypeIds !== undefined) {
        return normalizeAllowedFilamentMaterialTypeIds(
          existing.allowedFilamentMaterialTypeIds
        )
      }
      return undefined
    })(),
    trackInventory:
      input.trackInventory !== undefined
        ? Boolean(input.trackInventory)
        : Boolean(existing?.trackInventory),
    stockQuantity: normalizeStockQuantity(
      input.stockQuantity !== undefined
        ? input.stockQuantity
        : existing?.stockQuantity ?? 0
    ),
    lowStockThreshold: normalizeLowStockThreshold(
      input.lowStockThreshold !== undefined
        ? input.lowStockThreshold
        : existing?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD
    ),
    manualAvailability: normalizeManualAvailability(
      input.manualAvailability !== undefined
        ? input.manualAvailability
        : existing?.manualAvailability
    ),
    zeroStockBehavior: normalizeZeroStockBehavior(
      input.zeroStockBehavior !== undefined
        ? input.zeroStockBehavior
        : existing?.zeroStockBehavior
    ),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

export function resolveProductGallery(product: Product): string[] {
  if (product.galerieBilder?.length) return product.galerieBilder
  if (product.images?.length) return product.images
  return []
}

export function resolveProductModelUrl(product: Product): string | undefined {
  return product.modellDateiUrl ?? product.modelUrl
}

export function resolveProductCustomizationImage(
  product: Product
): string | undefined {
  return product.individualisierungsBild
}

export { resolveProductBasisPreis }
