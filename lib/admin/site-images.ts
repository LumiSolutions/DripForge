export type SiteImageEntry = {
  url: string
  alt: string
}

export type SiteImageField = {
  key: SiteImageKey
  label: string
  description?: string
}

export type SiteImageSection = {
  id: "landingpage" | "pages" | "brand"
  label: string
  fields: SiteImageField[]
}

const HERO_DEFAULT =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2017.%20Mai%202026%2C%2022_30_40-QRFbP2eouxkeDTfBuUpwhiWA8fn1Ng.png"
const EXPERTISE_DEFAULT =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2017.%20Mai%202026%2C%2000_02_54-d7wTZgFb3k2tGqbkACQpqJbzNVYTwR.png"
const PAGE_3D_HERO_DEFAULT =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pc3-BE2inKSo4vqNzyJPw5eT2lZzb9cXDP.jpg"
const LOGO_DEFAULT =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2016.%20Mai%202026%2C%2022_19_51-CjFqSwPCG95cJ4BMP2Ono6hKObBX8y.png"

export const DEFAULT_SITE_IMAGES = {
  landingpage_hero_image: {
    url: HERO_DEFAULT,
    alt: "DripForge",
  },
  landingpage_expertise_3d_image: {
    url: EXPERTISE_DEFAULT,
    alt: "3D Printer",
  },
  landingpage_expertise_laser_image: {
    url: EXPERTISE_DEFAULT,
    alt: "Laser Engraver",
  },
  page_3d_druck_hero_image: {
    url: PAGE_3D_HERO_DEFAULT,
    alt: "3D Printer",
  },
  brand_logo: {
    url: LOGO_DEFAULT,
    alt: "DripForge Logo",
  },
} as const satisfies Record<string, SiteImageEntry>

export type SiteImageKey = keyof typeof DEFAULT_SITE_IMAGES
export type SiteImages = Record<SiteImageKey, SiteImageEntry>

export const SITE_IMAGE_KEYS = Object.keys(DEFAULT_SITE_IMAGES) as SiteImageKey[]

export const SITE_IMAGE_SECTIONS: SiteImageSection[] = [
  {
    id: "landingpage",
    label: "Landingpage",
    fields: [
      { key: "landingpage_hero_image", label: "Hero-Bild" },
      { key: "landingpage_expertise_3d_image", label: "Expertise 3D-Druck" },
      {
        key: "landingpage_expertise_laser_image",
        label: "Expertise Lasergravur",
      },
    ],
  },
  {
    id: "pages",
    label: "Unterseiten",
    fields: [
      { key: "page_3d_druck_hero_image", label: "3D-Druck Banner" },
    ],
  },
  {
    id: "brand",
    label: "Marke",
    fields: [{ key: "brand_logo", label: "Logo" }],
  },
]

export function getSiteImageFieldMeta(key: SiteImageKey): SiteImageField {
  for (const section of SITE_IMAGE_SECTIONS) {
    const field = section.fields.find((f) => f.key === key)
    if (field) return field
  }
  return { key, label: key }
}

function sanitizeEntry(
  input: unknown,
  fallback: SiteImageEntry
): SiteImageEntry {
  if (!input || typeof input !== "object") return { ...fallback }
  const raw = input as Record<string, unknown>
  const url =
    typeof raw.url === "string" && raw.url.trim()
      ? raw.url.trim()
      : fallback.url
  const alt =
    typeof raw.alt === "string" ? raw.alt.trim() : fallback.alt
  return { url, alt }
}

export function mergeSiteImages(
  partial: Partial<Record<string, unknown>> | null | undefined
): SiteImages {
  const next = { ...DEFAULT_SITE_IMAGES } as SiteImages
  if (!partial || typeof partial !== "object") return next

  for (const key of SITE_IMAGE_KEYS) {
    if (key in partial) {
      next[key] = sanitizeEntry(partial[key], DEFAULT_SITE_IMAGES[key])
    }
  }
  return next
}

export function sanitizeSiteImagesInput(
  input: Partial<Record<string, unknown>> | null | undefined
): SiteImages {
  return mergeSiteImages(input)
}

/** Unique media URLs currently referenced by site images (mini library). */
export function collectSiteImageLibrary(images: SiteImages): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const key of SITE_IMAGE_KEYS) {
    const url = images[key]?.url?.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  return urls
}
