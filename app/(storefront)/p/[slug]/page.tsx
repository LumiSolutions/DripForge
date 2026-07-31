import { notFound, redirect } from "next/navigation"
import { ProductSlugPageClient } from "@/components/dripforge/product-slug-page-client"
import { getProducts } from "@/lib/admin/db"
import { isProductVisibleInShop } from "@/lib/admin/product-status"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import {
  isShopProductDocument,
  normalizeShopProduct,
} from "@/lib/dripforge/normalize-shop-product"
import {
  findProductBySlug,
  legacyProductIdFromSlug,
  productHref,
} from "@/lib/dripforge/product-slug"
import type { Product } from "@/lib/dripforge/types"

export const revalidate = 0
export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ slug: string }> }

async function loadVisibleCatalog(): Promise<Product[]> {
  await warmCosmosInfrastructure()
  return (await getProducts())
    .filter(
      (p) =>
        isShopProductDocument(p as Record<string, unknown>) &&
        isProductVisibleInShop(p)
    )
    .map(normalizeShopProduct)
}

/**
 * Produkt-Detail via /p/[slug].
 * Inaktive / archivierte Produkte → HTTP 404 (notFound).
 */
export default async function ProductSlugPage({ params }: PageProps) {
  const { slug: rawSlug } = await params
  const slug = decodeURIComponent(rawSlug ?? "").trim()
  if (!slug) notFound()

  let allActive: Product[]
  try {
    allActive = await loadVisibleCatalog()
  } catch (error) {
    console.error("Fehler beim Laden des Produkts per Slug:", error)
    notFound()
  }

  const legacyId = legacyProductIdFromSlug(slug)
  if (legacyId) {
    const byLegacy = allActive.find((p) => p.id === legacyId)
    if (!byLegacy) notFound()
    redirect(productHref(byLegacy, allActive))
  }

  const found = findProductBySlug(slug, allActive)
  if (!found) notFound()

  const canonical = productHref(found, allActive)
  if (canonical !== `/p/${slug}`) {
    redirect(canonical)
  }

  return <ProductSlugPageClient product={found} catalog={allActive} />
}
