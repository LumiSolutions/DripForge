"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { safeNavigate } from "@/lib/dripforge/safe-navigate"
import { ShopProductCard } from "@/components/dripforge/shared/shop-product-card"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import {
  limitedProductsForEvent,
  seasonalBadgeForProduct,
  useSeasonalEvent,
} from "@/components/dripforge/seasonal-storefront"
import { resolveProductImages } from "@/lib/dripforge/product-images-defaults"
import { NEUTRAL_PRODUCT_PLACEHOLDER } from "@/lib/dripforge/neutral-placeholder"
import { normalizeShopProduct } from "@/lib/dripforge/normalize-shop-product"
import { productHref } from "@/lib/dripforge/product-slug"
import { SHOP_ROUTES } from "@/lib/dripforge/shop-routes"
import type { Product } from "@/lib/dripforge/types"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function HomeLimitedEditionSection() {
  const router = useRouter()
  const { canInlineEdit } = useSiteTexts()
  const { activeEvent } = useSeasonalEvent()
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    let cancelled = false
    void fetch("/api/products", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.products)) return
        setProducts(
          data.products.map((product: Product) => normalizeShopProduct(product))
        )
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const limitedProducts = useMemo(
    () => limitedProductsForEvent(products, activeEvent).slice(0, 8),
    [products, activeEvent]
  )

  if (!activeEvent || limitedProducts.length === 0) {
    return null
  }

  return (
    <section className="py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 text-center md:mb-12">
          <p
            className="mb-3 text-sm font-semibold uppercase tracking-[0.18em]"
            style={{ color: activeEvent.accentColor }}
          >
            Limited Edition
          </p>
          <h2 className="text-3xl font-bold md:text-4xl">
            <span className="text-foreground">Limited Edition – </span>
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, ${activeEvent.accentColor}, #22d3ee)`,
              }}
            >
              {activeEvent.name}
            </span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Saisonale Specials – solange der Vorrat reicht.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {limitedProducts.map((product, index) => {
            const images = resolveProductImages(
              product.id,
              product.images,
              product.galerieBilder
            )
            const coverSrc =
              images.find(
                (src) =>
                  src &&
                  src !== NEUTRAL_PRODUCT_PLACEHOLDER &&
                  !/placeholder\.(svg|png|jpe?g|webp)$/i.test(src)
              ) ??
              images[0] ??
              NEUTRAL_PRODUCT_PLACEHOLDER
            const seasonalBadge = seasonalBadgeForProduct(product, activeEvent)

            return (
              <div key={product.id} className="min-h-[20rem] sm:min-h-[22rem]">
                <ShopProductCard
                  product={product}
                  coverSrc={coverSrc}
                  viewMode="grid3"
                  surface="brand"
                  canInlineEdit={canInlineEdit}
                  priority={index < 2}
                  seasonalBadgeLabel={seasonalBadge.label}
                  seasonalAccentColor={seasonalBadge.accentColor}
                  onOpen={() => {
                    if (canInlineEdit) return
                    safeNavigate(productHref(product, products), {
                      routerPush: (to) => router.push(to),
                    })
                  }}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <Button asChild variant="outline">
            <Link href={`${SHOP_ROUTES.shop}?filter=limited`}>
              Alle Limited Editions
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
