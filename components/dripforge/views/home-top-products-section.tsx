"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight, Printer, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { SiteTextPhrase } from "@/components/dripforge/site-text-phrase"
import { ProductShopPrice } from "@/components/dripforge/shared/product-shop-price"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import { getSaleBadgePercent } from "@/lib/dripforge/product-sale"
import { resolveProductImages } from "@/lib/dripforge/product-images-defaults"
import type { Product } from "@/lib/dripforge/types"
import { cn } from "@/lib/utils"

const SLIDER_PAGE_INSET_PX = 16

export function HomeTopProductsSection() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch("/api/products/top", { cache: "no-store" })
        const data = (await res.json()) as { products?: Product[] }
        if (!cancelled) {
          setProducts(Array.isArray(data.products) ? data.products : [])
        }
      } catch {
        if (!cancelled) setProducts([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const getScrollAmount = () => {
    const slider = sliderRef.current
    if (!slider) return 200
    // Eine Seite = genau 2 sichtbare Karten (Viewport abzüglich Gap)
    return Math.max(slider.clientWidth - SLIDER_PAGE_INSET_PX, 200)
  }

  const scrollByPage = (direction: -1 | 1) => {
    sliderRef.current?.scrollBy({
      left: direction * getScrollAmount(),
      behavior: "smooth",
    })
  }

  if (!products || products.length === 0) return null

  const desktopCols =
    products.length >= 4 ? "md:grid-cols-4" : products.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            <SiteTextPhrase
              parts={[
                { key: "landingpage_top_products_prefix", className: "text-foreground" },
                {
                  key: "landingpage_top_products_heading",
                  className:
                    "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                },
              ]}
            />
          </h2>
          <p className="mt-4 text-muted-foreground">
            <SiteText k="landingpage_top_products_subtitle" />
          </p>
        </div>

        <div className="relative w-full">
          <button
            type="button"
            aria-label="Vorheriges Produkt"
            className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/60 bg-background/90 p-2 shadow-md backdrop-blur-sm transition-colors hover:bg-background md:hidden"
            onClick={() => scrollByPage(-1)}
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>

          <div
            ref={sliderRef}
            className={cn(
              "flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-none snap-x snap-mandatory",
              "md:grid md:gap-6 md:overflow-x-visible md:px-0 md:pb-0 md:snap-none",
              desktopCols
            )}
          >
            {products.map((product) => {
              const images = resolveProductImages(
                product.id,
                product.images,
                product.galerieBilder
              )
              const imageSrc = images[0] ?? "/filaments/printed-pla-schwarz.png"
              const salePercent = getSaleBadgePercent(product)

              return (
                <Card
                  key={product.id}
                  data-top-product-card
                  className={cn(
                    "w-[calc(50%-8px)] min-w-[calc(50%-8px)] shrink-0 snap-start overflow-hidden border-border/50 bg-card/50 transition-colors hover:border-primary/50 hover:shadow-md",
                    "md:w-full md:min-w-0 md:shrink",
                    product.sale && "border-red-500/30 hover:border-red-500/60"
                  )}
                >
                  <Link href={`/shop/${encodeURIComponent(product.id)}`} className="block">
                    <div className="relative aspect-[4/3] bg-secondary/50">
                      {product.sale && salePercent != null && (
                        <span className="absolute left-3 top-3 z-10 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                          -{salePercent}%
                        </span>
                      )}
                      <SafeProductImage
                        src={imageSrc}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-contain p-4"
                      />
                    </div>
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        {product.type === "3d" ? (
                          <>
                            <Printer className="h-3 w-3" />
                            3D-Druck
                          </>
                        ) : (
                          <>
                            <Zap className="h-3 w-3" />
                            Laser
                          </>
                        )}
                      </div>
                      <h3 className="mb-1 font-bold">{product.name}</h3>
                      <p className="mb-4 line-clamp-2 text-xs text-muted-foreground">
                        {product.description}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <ProductShopPrice product={product} />
                        <span className="inline-flex items-center text-sm font-medium text-primary">
                          <SiteText k="landingpage_top_products_cta" />
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </span>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              )
            })}
          </div>

          <button
            type="button"
            aria-label="Nächstes Produkt"
            className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/60 bg-background/90 p-2 shadow-md backdrop-blur-sm transition-colors hover:bg-background md:hidden"
            onClick={() => scrollByPage(1)}
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </div>
    </section>
  )
}
