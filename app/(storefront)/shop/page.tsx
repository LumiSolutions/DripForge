"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PageShop } from "@/components/dripforge/views/page-shop"
import { useCart } from "@/components/dripforge/cart-provider"
import { useShopNavigate } from "@/hooks/use-shop-navigate"
import { useServiceVisibility } from "@/hooks/use-service-visibility"
import type { Product } from "@/lib/dripforge/types"
import { normalizeShopProduct } from "@/lib/dripforge/normalize-shop-product"

function ShopPageInner() {
  const navigate = useShopNavigate()
  const { addToCart } = useCart()
  const { services, shopConfigurators, isLoaded: servicesLoaded } = useServiceVisibility()
  const searchParams = useSearchParams()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  useEffect(() => {
    const productId = searchParams.get("product")?.trim()
    if (!productId) {
      setSelectedProduct(null)
      return
    }

    void fetch(`/api/products/${encodeURIComponent(productId)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.product) {
          setSelectedProduct(normalizeShopProduct(data.product as Product))
        }
      })
      .catch(() => {
        console.warn("Shop: Deep-Link-Produkt konnte nicht geladen werden.")
      })
  }, [searchParams])

  return (
    <PageShop
      setCurrentView={navigate}
      selectedProduct={selectedProduct}
      setSelectedProduct={setSelectedProduct}
      addToCart={addToCart}
      services={services}
      shopConfigurators={shopConfigurators}
      servicesLoaded={servicesLoaded}
    />
  )
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-muted-foreground">
          Shop wird geladen…
        </div>
      }
    >
      <ShopPageInner />
    </Suspense>
  )
}
