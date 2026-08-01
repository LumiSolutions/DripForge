"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

type SafeProductImageProps = {
  src: string
  alt: string
  className?: string
  fill?: boolean
  sizes?: string
  priority?: boolean
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
}: SafeProductImageProps) {
  const safeSrc = src?.trim() || "/placeholder.svg"

  if (!isOptimizableImageSrc(safeSrc)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={safeSrc}
        alt={alt}
        className={cn(fill ? "absolute inset-0 h-full w-full object-cover" : className)}
      />
    )
  }

  return (
    <Image
      src={safeSrc}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  )
}
