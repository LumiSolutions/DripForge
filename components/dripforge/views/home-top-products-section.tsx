"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import useEmblaCarousel from "embla-carousel-react"
import { ArrowRight, ChevronLeft, ChevronRight, Printer, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import { SiteTextPhrase } from "@/components/dripforge/site-text-phrase"
import { ProductShopPrice } from "@/components/dripforge/shared/product-shop-price"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import { getSaleBadgePercent } from "@/lib/dripforge/product-sale"
import { resolveProductImages } from "@/lib/dripforge/product-images-defaults"
import type { Product } from "@/lib/dripforge/types"
import { cn } from "@/lib/utils"

/** Genug Slides, damit Embla-Loop auch bei wenigen Produkten / 4 sichtbaren Karten greift. */
const MIN_LOOP_SLIDES = 8

type TopProductsResponse = {
  enabled?: boolean
  products?: Product[]
}

type LoopSlide = {
  key: string
  product: Product
}

function buildLoopSlides(products: Product[]): LoopSlide[] {
  if (products.length === 0) return []

  // Mindestens 2 Kopien, damit die Track-Breite die Viewport-Breite übersteigt
  // und Embla den Infinity-Loop zuverlässig aktiviert.
  const copies = Math.max(2, Math.ceil(MIN_LOOP_SLIDES / products.length))
  const slides: LoopSlide[] = []

  for (let copy = 0; copy < copies; copy += 1) {
    for (const product of products) {
      slides.push({
        key: `${product.id}__loop-${copy}`,
        product,
      })
    }
  }

  return slides
}

export function HomeTopProductsSection() {
  const { canInlineEdit } = useSiteTexts()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [enabled, setEnabled] = useState(true)

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    slidesToScroll: 1,
    containScroll: false,
    dragFree: false,
  })

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

  const slides = buildLoopSlides(products ?? [])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.reInit()
  }, [emblaApi, slides.length, products])

  const scrollPrev = () => {
    emblaApi?.scrollPrev()
  }

  const scrollNext = () => {
    emblaApi?.scrollNext()
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
            className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/60 bg-background/90 p-2 shadow-md backdrop-blur-sm transition-colors hover:bg-background md:left-0"
            onClick={scrollPrev}
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>

          <div
            className="overflow-hidden px-4 md:px-10"
            ref={emblaRef}
          >
            <div className="-ml-4 flex touch-pan-y md:-ml-6">
              {slides.map(({ key, product }) => {
                const images = resolveProductImages(
                  product.id,
                  product.images,
                  product.galerieBilder
                )
                const imageSrc = images[0] ?? "/filaments/printed-pla-schwarz.png"
                const salePercent = getSaleBadgePercent(product)

                return (
                  <div
                    key={key}
                    data-top-product-card
                    className={cn(
                      "min-w-0 shrink-0 grow-0 pl-4 md:pl-6",
                      // Mobile: ~2 sichtbar · md: ~3 · lg: ~4
                      "basis-1/2",
                      "md:basis-1/3",
                      "lg:basis-1/4"
                    )}
                  >
                    <Card
                      className={cn(
                        "h-full overflow-hidden border-border/50 bg-card/50 transition-colors hover:border-primary/50 hover:shadow-md",
                        product.sale && "border-red-500/30 hover:border-red-500/60"
                      )}
                    >
                      <Link
                        href={`/shop/${encodeURIComponent(product.id)}`}
                        className="block"
                        onClick={(event) => {
                          if (canInlineEdit) {
                            event.preventDefault()
                            event.stopPropagation()
                          }
                        }}
                      >
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
                  </div>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            aria-label="Nächstes Produkt"
            className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/60 bg-background/90 p-2 shadow-md backdrop-blur-sm transition-colors hover:bg-background md:right-0"
            onClick={scrollNext}
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </div>
    </section>
  )
}
