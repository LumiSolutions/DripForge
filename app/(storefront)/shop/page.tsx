"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PageShop } from "@/components/dripforge/views/page-shop"
import { useCart } from "@/components/dripforge/cart-provider"
import { useShopNavigate } from "@/hooks/use-shop-navigate"
import { useServiceVisibility } from "@/hooks/use-service-visibility"
import type { Product } from "@/lib/dripforge/types"
import { normalizeShopProduct } from "@/lib/dripforge/normalize-shop-product"
import { productHref } from "@/lib/dripforge/product-slug"
import { safeNavigate } from "@/lib/dripforge/safe-navigate"

function ShopPageInner() {
  const navigate = useShopNavigate()
  const router = useRouter()
  const { addToCart } = useCart()
  const { services, shopConfigurators, isLoaded: servicesLoaded } =
    useServiceVisibility()
  const searchParams = useSearchParams()

  useEffect(() => {
    const productId = searchParams.get("product")?.trim()
    if (!productId) return

    void (async () => {
      try {
        const [detailRes, listRes] = await Promise.all([
          fetch(`/api/products/${encodeURIComponent(productId)}`, {
            cache: "no-store",
          }),
          fetch("/api/products", { cache: "no-store" }),
        ])
        const detail = detailRes.ok ? await detailRes.json() : null
        const list = listRes.ok ? await listRes.json() : null
        const products = Array.isArray(list?.products)
          ? (list.products as Product[]).map(normalizeShopProduct)
          : []
        if (detail?.product) {
          const product = normalizeShopProduct(detail.product as Product)
          router.replace(productHref(product, products))
          return
        }
      } catch {
        /* ignore */
      }
      router.replace("/shop")
    })()
  }, [searchParams, router])

  return (
    <PageShop
      setCurrentView={navigate}
      selectedProduct={null}
      setSelectedProduct={(product) => {
        if (product) {
          safeNavigate(productHref(product), {
            routerPush: (to) => router.push(to),
          })
        }
      }}
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
