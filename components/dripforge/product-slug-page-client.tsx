"use client"

import { useRouter } from "next/navigation"
import { PageShop } from "@/components/dripforge/views/page-shop"
import { useCart } from "@/components/dripforge/cart-provider"
import { useShopNavigate } from "@/hooks/use-shop-navigate"
import { useServiceVisibility } from "@/hooks/use-service-visibility"
import type { Product } from "@/lib/dripforge/types"
import { productHref } from "@/lib/dripforge/product-slug"

type ProductSlugPageClientProps = {
  product: Product
  catalog: Product[]
}

export function ProductSlugPageClient({
  product,
  catalog,
}: ProductSlugPageClientProps) {
  const router = useRouter()
  const navigate = useShopNavigate()
  const { addToCart } = useCart()
  const { services, shopConfigurators, isLoaded: servicesLoaded } =
    useServiceVisibility()

  return (
    <PageShop
      setCurrentView={navigate}
      selectedProduct={product}
      setSelectedProduct={(next) => {
        if (!next) {
          router.push("/shop")
          return
        }
        router.replace(productHref(next, catalog.length ? catalog : [next]))
      }}
      addToCart={addToCart}
      services={services}
      shopConfigurators={shopConfigurators}
      servicesLoaded={servicesLoaded}
      productDetailMode
      productCatalog={catalog}
    />
  )
}
