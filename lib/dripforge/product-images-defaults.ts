/** Beispiel-Galeriebilder pro Shop-Produkt (Admin-Portal spaeter) */
export const PRODUCT_IMAGE_GALLERIES: Record<string, string[]> = {
  "1": [
    "/filaments/printed-pla-schwarz.png",
    "/filaments/printed-pla-weiss.png",
    "/filaments/printed-pla-blau.png",
    "/filaments/pla-schwarz.png",
  ],
  "2": [
    "/filaments/printed-pla-grau.png",
    "/filaments/printed-pla-schwarz.png",
    "/filaments/pla-grau.png",
    "/filaments/printed-pla-blau.png",
  ],
  "3": [
    "/filaments/printed-pla-silber.png",
    "/filaments/printed-pla-schwarz.png",
    "/filaments/pla-silber.png",
    "/filaments/printed-pla-rot.png",
  ],
  "4": [
    "/filaments/printed-pla-gruen.png",
    "/filaments/printed-pla-weiss.png",
    "/filaments/pla-gruen.png",
    "/filaments/printed-pla-orange.png",
  ],
}

const FALLBACK_GALLERY = [
  "/filaments/printed-pla-schwarz.png",
  "/filaments/printed-pla-weiss.png",
  "/filaments/pla-schwarz.png",
]

function sanitizeGallery(images: string[] | null | undefined): string[] {
  if (!Array.isArray(images)) return []
  return images
    .map((src) => (typeof src === "string" ? src.trim() : ""))
    .filter(Boolean)
}

export function resolveProductImages(
  productId: string,
  images?: string[] | null,
  galerieBilder?: string[] | null
): string[] {
  const gallery = sanitizeGallery(galerieBilder)
  if (gallery.length > 0) return gallery
  const legacy = sanitizeGallery(images)
  if (legacy.length > 0) return legacy
  return PRODUCT_IMAGE_GALLERIES[productId] ?? FALLBACK_GALLERY
}
