"use client"

import { useEffect, useState } from "react"
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
    ? images.filter((src): src is string => typeof src === "string" && Boolean(src.trim()))
    : []
  const galleryImages =
    safeImages.length > 0
      ? safeImages
      : ["/filaments/printed-pla-schwarz.png"]
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    setCurrentImageIndex(0)
  }, [images])

  const safeIndex = Math.min(currentImageIndex, galleryImages.length - 1)
  const mainSrc = galleryImages[safeIndex] ?? "/filaments/printed-pla-schwarz.png"

  const nextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === galleryImages.length - 1 ? 0 : prev + 1
    )
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? galleryImages.length - 1 : prev - 1
    )
  }

  const showNavigation = galleryImages.length > 1

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border/50 bg-secondary/30 shadow-sm">
        <SafeProductImage
          key={mainSrc}
          src={mainSrc}
          alt={`${alt} — Ansicht ${safeIndex + 1}`}
          fill
          className="object-cover transition-opacity duration-300"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority={safeIndex === 0}
        />

        {showNavigation && (
          <>
            <button
              type="button"
              onClick={prevImage}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 opacity-0 shadow transition-all hover:bg-white group-hover:opacity-100 dark:bg-card/80 dark:hover:bg-card"
              aria-label="Vorheriges Bild"
              title="Vorheriges Bild"
            >
              <ChevronLeft className="h-5 w-5 text-slate-800 dark:text-slate-100" />
            </button>
            <button
              type="button"
              onClick={nextImage}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 opacity-0 shadow transition-all hover:bg-white group-hover:opacity-100 dark:bg-card/80 dark:hover:bg-card"
              aria-label="Naechstes Bild"
              title="Naechstes Bild"
            >
              <ChevronRight className="h-5 w-5 text-slate-800 dark:text-slate-100" />
            </button>
          </>
        )}
      </div>

      {showNavigation && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Produktbilder"
        >
          {galleryImages.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              role="tab"
              aria-selected={safeIndex === index}
              aria-label={`Bild ${index + 1} anzeigen`}
              onClick={() => setCurrentImageIndex(index)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                safeIndex === index
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
