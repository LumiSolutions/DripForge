import { notFound, redirect } from "next/navigation"
import { getProductById } from "@/lib/admin/db"
import { isProductActive } from "@/lib/admin/normalize-product"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import {
  isShopProductDocument,
  normalizeShopProduct,
} from "@/lib/dripforge/normalize-shop-product"
import { productHref } from "@/lib/dripforge/product-slug"

export const revalidate = 0
export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ id: string }> }

/** Legacy /shop/[id] → /produkt/[slug] */
export default async function ShopProductDeepLinkPage({ params }: PageProps) {
  try {
    const { id } = await params
    const productId = decodeURIComponent(id).trim()

    if (!productId) {
      redirect("/shop")
    }

    await warmCosmosInfrastructure()
    const raw = await getProductById(productId)

    if (
      !raw ||
      !isShopProductDocument(raw as Record<string, unknown>) ||
      !isProductActive(raw)
    ) {
      console.error(
        "Fehler beim Laden des Produkts: Dokument fehlt, inaktiv oder docType ist nicht 'product'.",
        { productId }
      )
      notFound()
    }

    const product = normalizeShopProduct(raw)
    redirect(productHref(product))
  } catch (error) {
    // Next.js redirect() wirft — nicht als Fehler behandeln
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest ?? "").startsWith("NEXT_REDIRECT")
    ) {
      throw error
    }
    console.error("Fehler beim Laden des Produkts:", error)
    notFound()
  }
}
