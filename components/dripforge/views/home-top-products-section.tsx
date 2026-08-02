"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { safeNavigate } from "@/lib/dripforge/safe-navigate"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { SiteTextPhrase } from "@/components/dripforge/site-text-phrase"
import { ShopProductCard } from "@/components/dripforge/shared/shop-product-card"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
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
  const router = useRouter()
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

          <div className="overflow-hidden px-4 md:px-10" ref={emblaRef}>
            <div className="-ml-4 flex items-stretch touch-pan-y md:-ml-6">
              {slides.map(({ key, product }) => {
                const images = resolveProductImages(
                  product.id,
                  product.images,
                  product.galerieBilder
                )
                const coverSrc = images[0] ?? "/placeholder.svg"

                return (
                  <div
                    key={key}
                    data-top-product-card
                    className={cn(
                      "flex min-w-0 shrink-0 grow-0 items-stretch pl-4 md:pl-6",
                      "basis-1/2",
                      "md:basis-1/3",
                      "lg:basis-1/4"
                    )}
                  >
                    <div className="flex h-full min-h-[22rem] w-full flex-col sm:min-h-[24rem]">
                      <ShopProductCard
                        product={product}
                        coverSrc={coverSrc}
                        viewMode="grid3"
                        surface="brand"
                        canInlineEdit={canInlineEdit}
                        onOpen={() => {
                          if (canInlineEdit) return
                          safeNavigate(
                            `/shop/${encodeURIComponent(product.id)}`,
                            { routerPush: (to) => router.push(to) }
                          )
                        }}
                      />
                    </div>
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
