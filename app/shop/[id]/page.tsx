import { notFound, redirect } from "next/navigation"
import { getProductById } from "@/lib/admin/db"
import { isProductActive } from "@/lib/admin/normalize-product"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import {
  isShopProductDocument,
  normalizeShopProduct,
} from "@/lib/dripforge/normalize-shop-product"

export const revalidate = 0
export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ id: string }> }

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
    redirect(`/shop?product=${encodeURIComponent(product.id)}`)
  } catch (error) {
    console.error("Fehler beim Laden des Produkts:", error)
    notFound()
  }
}
