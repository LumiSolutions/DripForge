"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"

const FALLBACK_IMAGE_SRC = "/placeholder.svg"

/** Neutrales Skeleton-Grau (#F3F4F6) — kein roter Blur-Flash. */
const DEFAULT_BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4/OXbfwAJmAPdtH26kgAAAABJRU5ErkJggg=="

type SafeProductImageProps = {
  src: string
  alt: string
  className?: string
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  /** Nur Above-the-Fold-Hauptbilder — mappt auf preload. */
  priority?: boolean
  /** Next/Image Qualität (Karten/Thumbs niedriger). */
  quality?: number
  /** Optionaler Blur-Placeholder während des Ladens. */
  placeholder?: "blur" | "empty"
  blurDataURL?: string
}

function isOptimizableImageSrc(src: string): boolean {
  if (!src?.trim()) return false
  if (src.startsWith("data:") || src.startsWith("blob:")) return false
  return (
    src.startsWith("/") || src.startsWith("https://") || src.startsWith("http://")
  )
}

export function SafeProductImage({
  src,
  alt,
  className,
  fill,
  width,
  height,
  sizes,
  priority = false,
  quality,
  placeholder,
  blurDataURL,
}: SafeProductImageProps) {
  const requestedSrc = src?.trim() || FALLBACK_IMAGE_SRC
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const currentSrc =
    failedSrc === requestedSrc ? FALLBACK_IMAGE_SRC : requestedSrc

  const handleError = () => {
    if (requestedSrc !== FALLBACK_IMAGE_SRC) setFailedSrc(requestedSrc)
  }

  const resolvedSizes =
    sizes ??
    (fill
      ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      : undefined)
  // Thumbs/Swatches: niedrigere Default-Qualität; Hero mit priority etwas höher.
  const resolvedQuality =
    quality ?? (priority ? 75 : sizes && /\b(64|96|128)px\b/.test(sizes) ? 45 : 65)
  const useBlur = placeholder === "blur"
  const resolvedBlurDataURL = useBlur
    ? blurDataURL?.trim() || DEFAULT_BLUR_DATA_URL
    : undefined

  if (!isOptimizableImageSrc(currentSrc)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={currentSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={handleError}
        onLoad={() => setLoaded(true)}
        className={cn(
          fill ? "absolute inset-0 h-full w-full object-cover" : className
        )}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
      />
    )
  }

  return (
    <>
      {fill && !loaded ? (
        <div
          className="absolute inset-0 animate-pulse rounded-[inherit] bg-[#F3F4F6] dark:bg-zinc-800/80"
          aria-hidden
        />
      ) : null}
      <Image
        src={currentSrc}
        alt={alt}
        fill={fill}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        sizes={resolvedSizes}
        quality={resolvedQuality}
        placeholder={useBlur ? "blur" : undefined}
        blurDataURL={resolvedBlurDataURL}
        onError={handleError}
        onLoad={() => setLoaded(true)}
        className={cn(className, !loaded && fill && "opacity-0")}
        {...(priority
          ? { priority: true as const }
          : { loading: "lazy" as const })}
      />
    </>
  )
}
