"use client"

import { Suspense, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { PageShop } from "@/components/dripforge/views/page-shop"
import { useCart } from "@/components/dripforge/cart-provider"
import { useShopNavigate } from "@/hooks/use-shop-navigate"
import { useServiceVisibility } from "@/hooks/use-service-visibility"
import type { Product } from "@/lib/dripforge/types"
import { normalizeShopProduct } from "@/lib/dripforge/normalize-shop-product"
import { productIdFromSlug } from "@/lib/dripforge/product-slug"

function ProduktPageInner() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const navigate = useShopNavigate()
  const { addToCart } = useCart()
  const { services, shopConfigurators, isLoaded: servicesLoaded } =
    useServiceVisibility()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const slug = typeof params.slug === "string" ? params.slug : ""
    const productId = productIdFromSlug(slug)
    if (!productId) {
      setLoadError(true)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(false)

    void fetch(`/api/products/${encodeURIComponent(productId)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data?.product) {
          setSelectedProduct(normalizeShopProduct(data.product as Product))
          setLoadError(false)
        } else {
          setLoadError(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [params.slug])

  if (loading) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        Produkt wird geladen…
      </div>
    )
  }

  if (loadError || !selectedProduct) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-24 text-center">
        <p className="text-muted-foreground">Produkt nicht gefunden.</p>
        <button
          type="button"
          className="text-sm font-medium text-cyan-400 underline-offset-4 hover:underline"
          onClick={() => router.push("/shop")}
        >
          Zurück zum Shop
        </button>
      </div>
    )
  }

  return (
    <PageShop
      setCurrentView={navigate}
      selectedProduct={selectedProduct}
      setSelectedProduct={(next) => {
        if (!next) {
          router.push("/shop")
          return
        }
        setSelectedProduct(next)
      }}
      addToCart={addToCart}
      services={services}
      shopConfigurators={shopConfigurators}
      servicesLoaded={servicesLoaded}
      productDetailMode
    />
  )
}

export default function ProduktSlugPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-muted-foreground">
          Produkt wird geladen…
        </div>
      }
    >
      <ProduktPageInner />
    </Suspense>
  )
}
