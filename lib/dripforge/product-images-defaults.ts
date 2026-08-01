import { NEUTRAL_PRODUCT_PLACEHOLDER } from "@/lib/dripforge/neutral-placeholder"

/**
 * Keine hardcodierten Produkt-/KI-Galerien mehr.
 * Nur dynamische Galeriebilder aus der DB; sonst neutraler Platzhalter.
 */
export const PRODUCT_IMAGE_GALLERIES: Record<string, string[]> = {}

function sanitizeGallery(images: string[] | null | undefined): string[] {
  if (!Array.isArray(images)) return []
  return images
    .map((src) => (typeof src === "string" ? src.trim() : ""))
    .filter((src) => {
      if (!src) return false
      // Alte hardcodierte Filament-/KI-Demo-Pfade bewusst ausblenden
      if (src.startsWith("/filaments/")) return false
      return true
    })
}

export function resolveProductImages(
  productId: string,
  images?: string[] | null,
  galerieBilder?: string[] | null
): string[] {
  void productId
  const gallery = sanitizeGallery(galerieBilder)
  if (gallery.length > 0) return gallery
  const legacy = sanitizeGallery(images)
  if (legacy.length > 0) return legacy
  return [NEUTRAL_PRODUCT_PLACEHOLDER]
}
