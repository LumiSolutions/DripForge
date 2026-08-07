/** Custom CMS Unterseiten: Content-Blocks & Publish-Status. */

export const CMS_PAGE_BLOCK_TYPES = [
  "richtext",
  "imageText",
  "gallery",
  "faq",
  "contact",
] as const

export type CmsPageBlockType = (typeof CMS_PAGE_BLOCK_TYPES)[number]

export type CmsPageFaqItem = {
  id: string
  question: string
  answer: string
}

export type CmsPageBlock = {
  id: string
  type: CmsPageBlockType
  sortOrder: number
  /** richtext */
  html?: string
  /** imageText */
  imageUrl?: string | null
  imageAlt?: string
  textHtml?: string
  imagePosition?: "left" | "right"
  /** gallery */
  images?: string[]
  /** faq */
  faqItems?: CmsPageFaqItem[]
  /** contact embed */
  showContactForm?: boolean
}

export type CmsCustomPageContent = {
  slug: string
  published: boolean
  heroTitle: string
  heroSubtitle: string
  bannerImageUrl: string | null
  blocks: CmsPageBlock[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function slugifyCmsPathSegment(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
}

export function customPagePathFromSlug(slug: string): string {
  const clean = slugifyCmsPathSegment(slug) || "seite"
  return `/seiten/${clean}`
}

export function slugFromCmsPagePath(path: string): string | null {
  const normalized = path.trim().replace(/\/+$/, "") || "/"
  const match = normalized.match(/^\/seiten\/([^/]+)$/i)
  if (!match?.[1]) return null
  return slugifyCmsPathSegment(match[1]) || null
}

function cleanString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function sanitizeFaqItems(input: unknown): CmsPageFaqItem[] {
  if (!Array.isArray(input)) return []
  return input
    .map((raw, index) => {
      if (!isRecord(raw)) return null
      const id =
        typeof raw.id === "string" && raw.id.trim()
          ? raw.id.trim()
          : `faq-${index}`
      const question = cleanString(raw.question).trim()
      const answer = cleanString(raw.answer).trim()
      if (!question && !answer) return null
      return { id, question: question || "Frage", answer }
    })
    .filter((item): item is CmsPageFaqItem => item !== null)
}

function sanitizeImages(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
    .slice(0, 24)
}

export function sanitizeCmsPageBlock(
  raw: unknown,
  index: number
): CmsPageBlock | null {
  if (!isRecord(raw)) return null
  const type = raw.type
  if (
    typeof type !== "string" ||
    !(CMS_PAGE_BLOCK_TYPES as readonly string[]).includes(type)
  ) {
    return null
  }
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `block-${index}`
  const sortOrder =
    typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
      ? raw.sortOrder
      : index

  const base: CmsPageBlock = {
    id,
    type: type as CmsPageBlockType,
    sortOrder,
  }

  switch (base.type) {
    case "richtext":
      return { ...base, html: cleanString(raw.html) }
    case "imageText":
      return {
        ...base,
        imageUrl:
          typeof raw.imageUrl === "string" && raw.imageUrl.trim()
            ? raw.imageUrl.trim()
            : null,
        imageAlt: cleanString(raw.imageAlt).slice(0, 160),
        textHtml: cleanString(raw.textHtml),
        imagePosition: raw.imagePosition === "right" ? "right" : "left",
      }
    case "gallery":
      return { ...base, images: sanitizeImages(raw.images) }
    case "faq":
      return { ...base, faqItems: sanitizeFaqItems(raw.faqItems) }
    case "contact":
      return { ...base, showContactForm: raw.showContactForm !== false }
    default:
      return base
  }
}

export function sanitizeCmsPageBlocks(input: unknown): CmsPageBlock[] {
  if (!Array.isArray(input)) return []
  return input
    .map((block, index) => sanitizeCmsPageBlock(block, index))
    .filter((block): block is CmsPageBlock => block !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((block, index) => ({ ...block, sortOrder: index }))
}

export function createEmptyCmsPageBlock(type: CmsPageBlockType): CmsPageBlock {
  const id = `block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  switch (type) {
    case "richtext":
      return { id, type, sortOrder: 0, html: "<p></p>" }
    case "imageText":
      return {
        id,
        type,
        sortOrder: 0,
        imageUrl: null,
        imageAlt: "",
        textHtml: "<p></p>",
        imagePosition: "left",
      }
    case "gallery":
      return { id, type, sortOrder: 0, images: [] }
    case "faq":
      return {
        id,
        type,
        sortOrder: 0,
        faqItems: [
          {
            id: `faq-${Date.now().toString(36)}`,
            question: "Neue Frage",
            answer: "",
          },
        ],
      }
    case "contact":
      return { id, type, sortOrder: 0, showContactForm: true }
  }
}

export function sanitizeCmsCustomPageContent(
  input: Partial<CmsCustomPageContent> | Record<string, unknown> | null | undefined,
  fallbackSlug: string
): CmsCustomPageContent {
  const raw = isRecord(input) ? input : {}
  const slug =
    slugifyCmsPathSegment(cleanString(raw.slug, fallbackSlug)) ||
    slugifyCmsPathSegment(fallbackSlug) ||
    "seite"
  return {
    slug,
    published: raw.published === true,
    heroTitle: cleanString(raw.heroTitle).slice(0, 160),
    heroSubtitle: cleanString(raw.heroSubtitle).slice(0, 320),
    bannerImageUrl:
      typeof raw.bannerImageUrl === "string" && raw.bannerImageUrl.trim()
        ? raw.bannerImageUrl.trim()
        : null,
    blocks: sanitizeCmsPageBlocks(raw.blocks),
  }
}
