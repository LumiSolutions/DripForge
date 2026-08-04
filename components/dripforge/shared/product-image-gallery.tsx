"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react"
import { createPortal } from "react-dom"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import { ProductDetailErrorBoundary } from "@/components/dripforge/product-detail-error-boundary"
import { cn } from "@/lib/utils"

type ProductImageGalleryProps = {
  images: string[]
  alt: string
  className?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function LightboxZoomImage({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null)
  const dragRef = useRef<{
    x: number
    y: number
    ox: number
    oy: number
  } | null>(null)
  const lastTapRef = useRef(0)
  const scaleRef = useRef(1)
  scaleRef.current = scale

  const reset = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setDragging(false)
    dragRef.current = null
  }, [])

  useEffect(() => {
    reset()
  }, [src, reset])

  // Non-passive wheel listener — React onWheel is often passive and can't preventDefault.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheelNative = (event: WheelEvent) => {
      event.preventDefault()
      const delta = event.deltaY > 0 ? -0.15 : 0.15
      const next = clamp(scaleRef.current + delta, 1, 4)
      scaleRef.current = next
      setScale(next)
      if (next <= 1) {
        setOffset((o) => (o.x === 0 && o.y === 0 ? o : { x: 0, y: 0 }))
      }
    }
    el.addEventListener("wheel", onWheelNative, { passive: false })
    return () => el.removeEventListener("wheel", onWheelNative)
  }, [])

  const onMouseDown = (event: ReactMouseEvent) => {
    if (event.button !== 0 || scaleRef.current <= 1) return
    event.preventDefault()
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    }
    setDragging(true)
  }

  const onMouseMove = (event: ReactMouseEvent) => {
    if (!dragRef.current || scaleRef.current <= 1) return
    event.preventDefault()
    setOffset({
      x: dragRef.current.ox + (event.clientX - dragRef.current.x),
      y: dragRef.current.oy + (event.clientY - dragRef.current.y),
    })
  }

  const endMouseDrag = () => {
    dragRef.current = null
    setDragging(false)
  }

  const onTouchStart = (event: ReactTouchEvent) => {
    if (event.touches.length === 2) {
      const [a, b] = [event.touches[0]!, event.touches[1]!]
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchRef.current = { distance, scale: scaleRef.current }
      dragRef.current = null
      return
    }
    if (event.touches.length === 1 && scaleRef.current > 1) {
      const touch = event.touches[0]!
      dragRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        ox: offset.x,
        oy: offset.y,
      }
    }
  }

  const onTouchMove = (event: ReactTouchEvent) => {
    if (event.touches.length === 2 && pinchRef.current) {
      event.preventDefault()
      const [a, b] = [event.touches[0]!, event.touches[1]!]
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const next = clamp(
        (pinchRef.current.scale * distance) / pinchRef.current.distance,
        1,
        4
      )
      setScale(next)
      if (next <= 1) {
        setOffset((o) => (o.x === 0 && o.y === 0 ? o : { x: 0, y: 0 }))
      }
      return
    }
    if (event.touches.length === 1 && dragRef.current && scaleRef.current > 1) {
      event.preventDefault()
      const touch = event.touches[0]!
      setOffset({
        x: dragRef.current.ox + (touch.clientX - dragRef.current.x),
        y: dragRef.current.oy + (touch.clientY - dragRef.current.y),
      })
    }
  }

  const onTouchEnd = (event: ReactTouchEvent) => {
    if (event.touches.length < 2) pinchRef.current = null
    if (event.touches.length === 0) {
      dragRef.current = null
      const now = Date.now()
      if (now - lastTapRef.current < 280) {
        if (scaleRef.current > 1) reset()
        else setScale(2)
      }
      lastTapRef.current = now
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-[min(80vh,720px)] w-full touch-none items-center justify-center overflow-hidden",
        scale > 1
          ? dragging
            ? "cursor-grabbing"
            : "cursor-grab"
          : "cursor-zoom-in"
      )}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endMouseDrag}
      onMouseLeave={endMouseDrag}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={() => {
        if (scaleRef.current > 1) reset()
        else setScale(2)
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onError={(event) => {
          const el = event.currentTarget
          if (el.src.endsWith("/placeholder.svg")) return
          el.src = "/placeholder.svg"
        }}
        className="max-h-full max-w-full select-none object-contain transition-transform duration-150"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
      />
      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[11px] text-white/90">
        Mausrad zoomen · Ziehen zum Verschieben · Pinch / Doppeltipp
      </p>
    </div>
  )
}

/**
 * Lightweight lightbox (no Radix Dialog) — avoids open-state feedback loops with
 * Three.js / parent re-renders. Mounted via portal to document.body.
 */
function ImageLightbox({
  open,
  onClose,
  src,
  alt,
  showNavigation,
  onPrev,
  onNext,
}: {
  open: boolean
  onClose: () => void
  src: string
  alt: string
  showNavigation: boolean
  onPrev: () => void
  onNext: () => void
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key === "ArrowLeft") onPrev()
      if (event.key === "ArrowRight") onNext()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose, onPrev, onNext])

  if (!mounted || !open || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} — Vollbild`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-20 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
        aria-label="Schliessen"
      >
        <X className="h-4 w-4" />
      </button>
      {showNavigation && (
        <>
          <button
            type="button"
            onClick={onPrev}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            aria-label="Vorheriges Bild"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onNext}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            aria-label="Nächstes Bild"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
      <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <ProductDetailErrorBoundary onError={onClose} fallback={null}>
          <LightboxZoomImage src={src} alt={alt} />
        </ProductDetailErrorBoundary>
      </div>
    </div>,
    document.body
  )
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
    safeImages.length > 0 ? safeImages : ["/placeholder.svg"]

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: galleryImages.length > 1,
    align: "start",
    dragFree: false,
    containScroll: "trimSnaps",
    axis: "x",
    watchDrag: true,
  })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

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

  // Stabiler Schlüssel über den Bild-INHALT: Parent liefert oft neue Array-Referenzen.
  const imagesKey = galleryImages.join("|")
  useEffect(() => {
    if (!emblaApi) return
    emblaApi.reInit()
    emblaApi.scrollTo(0, true)
    setSelectedIndex(0)
  }, [emblaApi, imagesKey])

  const showNavigation = galleryImages.length > 1

  const scrollTo = (index: number) => {
    setSelectedIndex(index)
    emblaApi?.scrollTo(index)
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
  }, [])

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length)
  }, [galleryImages.length])

  const goNext = useCallback(() => {
    setLightboxIndex((i) => (i + 1) % galleryImages.length)
  }, [galleryImages.length])

  const lightboxSrc =
    galleryImages[lightboxIndex] ?? galleryImages[0] ?? "/placeholder.svg"

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="group relative w-full overflow-hidden rounded-xl border border-border/50 bg-secondary/30 shadow-sm">
        <div className="overflow-hidden touch-pan-y" ref={emblaRef}>
          <div className="flex">
            {galleryImages.map((src, index) => (
              <button
                key={`${src}-${index}`}
                type="button"
                className="relative aspect-square min-w-0 shrink-0 grow-0 basis-full cursor-zoom-in touch-pan-y"
                onClick={() => openLightbox(index)}
                aria-label={`${alt} — Bild ${index + 1} vergrößern`}
              >
                <SafeProductImage
                  src={src}
                  alt={`${alt} — Ansicht ${index + 1}`}
                  fill
                  className="pointer-events-none object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority={index === 0}
                />
                <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[11px] text-white opacity-80">
                  <ZoomIn className="h-3 w-3" />
                  Zoomen
                </span>
              </button>
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
                quality={45}
              />
            </button>
          ))}
        </div>
      )}

      <ImageLightbox
        open={lightboxOpen}
        onClose={closeLightbox}
        src={lightboxSrc}
        alt={`${alt} — Ansicht ${lightboxIndex + 1}`}
        showNavigation={showNavigation}
        onPrev={goPrev}
        onNext={goNext}
      />
    </div>
  )
}
