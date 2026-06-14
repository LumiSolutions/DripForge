import { parseVariantenFromAdmin } from "@/lib/dripforge/product-varianten"
import {
  applySaleToProductFields,
  resolveProductBasisPreis,
  roundChf,
  validateSaleDiscount,
} from "@/lib/dripforge/product-sale"
import type { AdminProduct } from "@/lib/admin/types"
import type { Product } from "@/lib/dripforge/types"
import { normalizeProductTagIds } from "@/lib/admin/product-tags"

export function normalizeAdminProductInput(
  input: Partial<AdminProduct> & { variantenText?: string; basisPreis?: number },
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

  const istAktiv =
    input.istAktiv !== undefined
      ? Boolean(input.istAktiv)
      : existing?.istAktiv !== false

  const sale = input.sale !== undefined ? Boolean(input.sale) : Boolean(existing?.sale)

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

  return {
    id: input.id ?? existing?.id ?? `p-${Date.now()}`,
    name: input.name?.trim() ?? existing?.name ?? "Neues Produkt",
    description: input.description?.trim() ?? existing?.description ?? "",
    ...saleFields,
    type: (input.type ?? existing?.type) === "laser" ? "laser" : "3d",
    istAktiv,
    laserMaterialId: input.laserMaterialId ?? existing?.laserMaterialId,
    galerieBilder,
    individualisierungsBild,
    modellDateiUrl,
    images: galerieBilder,
    modelUrl: modellDateiUrl,
    dimensionsMm: input.dimensionsMm ?? existing?.dimensionsMm,
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
    materialLinks: input.materialLinks ?? existing?.materialLinks ?? [],
    tags: normalizeProductTagIds(input.tags ?? existing?.tags),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

export function isProductActive(product: Pick<Product, "istAktiv">): boolean {
  return product.istAktiv !== false
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
