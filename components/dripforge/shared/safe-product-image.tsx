"use client"

import Image from "next/image"
import { useState } from "react"
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
  const requestedSrc = src?.trim() || FALLBACK_IMAGE_SRC
  // Merkt sich den zuletzt fehlgeschlagenen Pfad. Ändert sich `src`, unterscheidet
  // er sich automatisch wieder → kein Reset-Effekt nötig.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const currentSrc =
    failedSrc === requestedSrc ? FALLBACK_IMAGE_SRC : requestedSrc

  const handleError = () => {
    if (requestedSrc !== FALLBACK_IMAGE_SRC) setFailedSrc(requestedSrc)
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
