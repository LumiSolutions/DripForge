"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const FALLBACK_IMAGE_SRC = "/placeholder.svg"

type SafeProductImageProps = {
  src: string
  alt: string
  className?: string
  fill?: boolean
  sizes?: string
  priority?: boolean
  /** Next/Image Kompressionsqualität (Standard 75). Für Thumbnails/Karten niedriger. */
  quality?: number
}

function isOptimizableImageSrc(src: string): boolean {
  if (!src?.trim()) return false
  if (src.startsWith("data:") || src.startsWith("blob:")) return false
  return src.startsWith("/") || src.startsWith("https://") || src.startsWith("http://")
}

export function SafeProductImage({
  src,
  alt,
  className,
  fill,
  sizes,
  priority,
  quality,
}: SafeProductImageProps) {
  const initialSrc = src?.trim() || FALLBACK_IMAGE_SRC
  const [currentSrc, setCurrentSrc] = useState(initialSrc)

  // Bei Bildwechsel (z. B. neues Produkt) den Fehlerzustand zurücksetzen.
  useEffect(() => {
    setCurrentSrc(src?.trim() || FALLBACK_IMAGE_SRC)
  }, [src])

  const handleError = () => {
    // Fehlgeschlagenes Bild einmalig auf Platzhalter zurückfallen lassen.
    setCurrentSrc((prev) => (prev === FALLBACK_IMAGE_SRC ? prev : FALLBACK_IMAGE_SRC))
  }

  if (!isOptimizableImageSrc(currentSrc)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={currentSrc}
        alt={alt}
        onError={handleError}
        className={cn(fill ? "absolute inset-0 h-full w-full object-cover" : className)}
      />
    )
  }

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      quality={quality}
      onError={handleError}
      className={className}
    />
  )
}
