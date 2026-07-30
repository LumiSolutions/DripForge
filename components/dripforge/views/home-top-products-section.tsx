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

const SCROLL_EDGE_EPS_PX = 2

type TopProductsResponse = {
  enabled?: boolean
  products?: Product[]
}

export function HomeTopProductsSection() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const sliderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch("/api/products/top", { cache: "no-store" })
        const data = (await res.json()) as TopProductsResponse
        if (!cancelled) {
          setEnabled(data.enabled !== false)
          setProducts(Array.isArray(data.products) ? data.products : [])
        }
      } catch {
        if (!cancelled) {
          setEnabled(true)
          setProducts([])
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const slider = sliderRef.current
    if (!slider || !products?.length) return

    const updateScrollState = () => {
      const maxScroll = slider.scrollWidth - slider.clientWidth
      const hasOverflow = maxScroll > SCROLL_EDGE_EPS_PX
      setCanScrollLeft(hasOverflow && slider.scrollLeft > SCROLL_EDGE_EPS_PX)
      setCanScrollRight(
        hasOverflow && slider.scrollLeft < maxScroll - SCROLL_EDGE_EPS_PX
      )
    }

    updateScrollState()

    const onScroll = () => updateScrollState()
    slider.addEventListener("scroll", onScroll, { passive: true })

    const resizeObserver = new ResizeObserver(() => updateScrollState())
    resizeObserver.observe(slider)

    return () => {
      slider.removeEventListener("scroll", onScroll)
      resizeObserver.disconnect()
    }
  }, [products])

  const getCardScrollAmount = () => {
    const slider = sliderRef.current
    if (!slider) return 240

    const card = slider.querySelector<HTMLElement>("[data-top-product-card]")
    if (!card) return Math.max(slider.clientWidth * 0.5, 200)

    const styles = getComputedStyle(slider)
    const gap =
      Number.parseFloat(styles.columnGap || styles.gap || "0") || 16

    return card.getBoundingClientRect().width + gap
  }

  const scrollByCard = (direction: -1 | 1) => {
    sliderRef.current?.scrollBy({
      left: direction * getCardScrollAmount(),
      behavior: "smooth",
    })
  }

  if (!enabled || !products || products.length === 0) return null

  return (
    <section className="py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 text-center md:mb-12">
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
            disabled={!canScrollLeft}
            aria-disabled={!canScrollLeft}
            className={cn(
              "absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/60 bg-background/90 p-2 shadow-md backdrop-blur-sm transition-all hover:bg-background md:left-0",
              canScrollLeft
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            )}
            onClick={() => scrollByCard(-1)}
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>

          <div
            ref={sliderRef}
            className={cn(
              "flex flex-nowrap gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 scroll-smooth scrollbar-none",
              "snap-x snap-mandatory touch-pan-x",
              "md:gap-6 md:px-10"
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
                    // Mobile: ~2 sichtbar · md: ~3 · lg: ~4 — nie umbrechen
                    "w-[calc(50%-8px)] min-w-[calc(50%-8px)] shrink-0 snap-start overflow-hidden border-border/50 bg-card/50 transition-colors hover:border-primary/50 hover:shadow-md",
                    "md:w-[calc((100%-3rem)/3)] md:min-w-[calc((100%-3rem)/3)]",
                    "lg:w-[calc((100%-4.5rem)/4)] lg:min-w-[calc((100%-4.5rem)/4)]",
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
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
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
            disabled={!canScrollRight}
            aria-disabled={!canScrollRight}
            className={cn(
              "absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/60 bg-background/90 p-2 shadow-md backdrop-blur-sm transition-all hover:bg-background md:right-0",
              canScrollRight
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            )}
            onClick={() => scrollByCard(1)}
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </div>
    </section>
  )
}
