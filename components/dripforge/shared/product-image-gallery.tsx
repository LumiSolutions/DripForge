"use client"

import { useCallback, useEffect, useState } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import { cn } from "@/lib/utils"

type ProductImageGalleryProps = {
  images: string[]
  alt: string
  className?: string
}

export function ProductImageGallery({
  images,
  alt,
  className,
}: ProductImageGalleryProps) {
  const safeImages = Array.isArray(images)
    ? images.filter(
        (src): src is string => typeof src === "string" && Boolean(src.trim())
      )
    : []
  const galleryImages =
    safeImages.length > 0
      ? safeImages
      : ["/filaments/printed-pla-schwarz.png"]

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: galleryImages.length > 1,
    align: "start",
    dragFree: false,
    containScroll: "trimSnaps",
  })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on("select", onSelect)
    emblaApi.on("reInit", onSelect)
    return () => {
      emblaApi.off("select", onSelect)
      emblaApi.off("reInit", onSelect)
    }
  }, [emblaApi, onSelect])

  useEffect(() => {
    emblaApi?.reInit()
    emblaApi?.scrollTo(0, true)
    setSelectedIndex(0)
  }, [emblaApi, galleryImages.length, images])

  const showNavigation = galleryImages.length > 1

  const scrollTo = (index: number) => {
    emblaApi?.scrollTo(index)
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="group relative w-full overflow-hidden rounded-xl border border-border/50 bg-secondary/30 shadow-sm">
        <div className="overflow-hidden touch-pan-y" ref={emblaRef}>
          <div className="flex touch-pan-x">
            {galleryImages.map((src, index) => (
              <div
                key={`${src}-${index}`}
                className="relative aspect-square min-w-0 shrink-0 grow-0 basis-full"
              >
                <SafeProductImage
                  src={src}
                  alt={`${alt} — Ansicht ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority={index === 0}
                />
              </div>
            ))}
          </div>
        </div>

        {showNavigation && (
          <>
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 opacity-0 shadow transition-all hover:bg-white group-hover:opacity-100 max-md:opacity-70 dark:bg-card/80 dark:hover:bg-card"
              aria-label="Vorheriges Bild"
            >
              <ChevronLeft className="h-5 w-5 text-slate-800 dark:text-slate-100" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 opacity-0 shadow transition-all hover:bg-white group-hover:opacity-100 max-md:opacity-70 dark:bg-card/80 dark:hover:bg-card"
              aria-label="Nächstes Bild"
            >
              <ChevronRight className="h-5 w-5 text-slate-800 dark:text-slate-100" />
            </button>
          </>
        )}
      </div>

      {showNavigation && (
        <div
          className="flex items-center justify-center gap-1.5"
          role="tablist"
          aria-label="Produktbilder"
        >
          {galleryImages.map((_, index) => (
            <button
              key={`dot-${index}`}
              type="button"
              role="tab"
              aria-selected={selectedIndex === index}
              aria-label={`Bild ${index + 1} anzeigen`}
              onClick={() => scrollTo(index)}
              className={cn(
                "h-2 w-2 rounded-full transition-all",
                selectedIndex === index
                  ? "w-4 bg-primary"
                  : "bg-muted-foreground/35 hover:bg-muted-foreground/55"
              )}
            />
          ))}
        </div>
      )}

      {showNavigation && (
        <div
          className="hidden gap-2 overflow-x-auto pb-1 md:flex"
          role="tablist"
          aria-label="Produktbilder Vorschau"
        >
          {galleryImages.map((src, index) => (
            <button
              key={`${src}-thumb-${index}`}
              type="button"
              role="tab"
              aria-selected={selectedIndex === index}
              aria-label={`Bild ${index + 1} anzeigen`}
              onClick={() => scrollTo(index)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                selectedIndex === index
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border/60 opacity-80 hover:border-primary/50 hover:opacity-100"
              )}
            >
              <SafeProductImage
                src={src}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
