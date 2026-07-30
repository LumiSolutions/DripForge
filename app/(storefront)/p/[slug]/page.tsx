"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { PageShop } from "@/components/dripforge/views/page-shop"
import { useCart } from "@/components/dripforge/cart-provider"
import { useShopNavigate } from "@/hooks/use-shop-navigate"
import { useServiceVisibility } from "@/hooks/use-service-visibility"
import type { Product } from "@/lib/dripforge/types"
import { normalizeShopProduct } from "@/lib/dripforge/normalize-shop-product"
import {
  findProductBySlug,
  legacyProductIdFromSlug,
  productHref,
} from "@/lib/dripforge/product-slug"

function ProductBySlugInner() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const navigate = useShopNavigate()
  const { addToCart } = useCart()
  const { services, shopConfigurators, isLoaded: servicesLoaded } =
    useServiceVisibility()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [catalog, setCatalog] = useState<Product[]>([])
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const slug = typeof params.slug === "string" ? params.slug : ""
    if (!slug) {
      setLoadError(true)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(false)

    void (async () => {
      try {
        // Legacy name--id → saubere /p/slug URL
        const legacyId = legacyProductIdFromSlug(slug)
        if (legacyId) {
          const res = await fetch(
            `/api/products/${encodeURIComponent(legacyId)}`,
            { cache: "no-store" }
          )
          const data = res.ok ? await res.json() : null
          if (cancelled) return
          if (data?.product) {
            const product = normalizeShopProduct(data.product as Product)
            const listRes = await fetch("/api/products", { cache: "no-store" })
            const listData = listRes.ok ? await listRes.json() : null
            const products = Array.isArray(listData?.products)
              ? (listData.products as Product[]).map(normalizeShopProduct)
              : [product]
            router.replace(productHref(product, products))
            return
          }
        }

        const listRes = await fetch("/api/products", { cache: "no-store" })
        const listData = listRes.ok ? await listRes.json() : null
        if (cancelled) return
        const products = Array.isArray(listData?.products)
          ? (listData.products as Product[]).map(normalizeShopProduct)
          : []
        setCatalog(products)

        const found = findProductBySlug(slug, products)
        if (found) {
          setSelectedProduct(found)
          setLoadError(false)
        } else {
          setLoadError(true)
        }
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [params.slug, router])

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

export default function ProductSlugPage() {
  return <ProductBySlugInner />
}
