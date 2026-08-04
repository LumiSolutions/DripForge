"use client"

import { SiteImage } from "@/components/dripforge/editable-site-image"
import { useBranding } from "@/hooks/use-branding"
import { cn } from "@/lib/utils"

/**
 * Kleine Icon-Marke (Slot 1) für Header/Footer. Nutzt ein einfaches <img>
 * (kein next/image), damit SVG/Data-/Blob-URLs auf allen Browsern inkl.
 * Safari/iOS zuverlässig dargestellt werden (kein Fragezeichen-Platzhalter).
 * Fallback: bisheriges CMS-Logo (brand_logo).
 */
export function BrandIconImage({
  size = 32,
  className,
}: {
  size?: number
  className?: string
}) {
  const { brandIconUrl } = useBranding()

  if (brandIconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brandIconUrl}
        alt="DripForge"
        width={size}
        height={size}
        className={cn("shrink-0 rounded object-contain", className)}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <SiteImage
      imageKey="brand_logo"
      width={size}
      height={size}
      imageClassName={cn("rounded", className)}
      className="shrink-0"
    />
  )
}
