/** Custom CMS Unterseiten: Content-Blocks, Layout-Rows & saubere Pfade. */

export const CMS_PAGE_BLOCK_TYPES = [
  "richtext",
  "imageText",
  "gallery",
  "faq",
  "contact",
  "valueCards",
  "cta",
] as const

export type CmsPageBlockType = (typeof CMS_PAGE_BLOCK_TYPES)[number]
export type CmsPageColumnLayout = "1" | "2" | "3"

export type CmsPageFaqItem = {
  id: string
  question: string
  answer: string
}

export type CmsValueCard = {
  id: string
  icon: string
  title: string
  description: string
}

export type CmsPageRow = {
  id: string
  layout: CmsPageColumnLayout
  sortOrder: number
}

export type CmsPageBlock = {
  id: string
  type: CmsPageBlockType
  sortOrder: number
  rowId: string
  columnIndex: number
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
  /** valueCards */
  cards?: CmsValueCard[]
  /** cta */
  ctaTitle?: string
  ctaButtonLabel?: string
  ctaButtonHref?: string
}

export type CmsCustomPageContent = {
  slug: string
  published: boolean
  heroTitle: string
  heroSubtitle: string
  bannerImageUrl: string | null
  rows: CmsPageRow[]
  blocks: CmsPageBlock[]
}

/** Storefront-/System-Pfade, die Custom-Pages nicht überschreiben dürfen. */
export const CMS_RESERVED_PATH_PREFIXES = [
  "api",
  "konto",
  "shop",
  "p",
  "produkt",
  "3d-druck",
  "laser",
  "kontakt",
  "warenkorb",
  "checkout",
  "bestellung",
  "konfigurator",
  "faq",
  "impressum",
  "agb",
  "datenschutz",
  "support",
  "staging",
  "test",
  "vorschau",
  "offerte",
  "dripforgehq",
  "admin",
  "seiten",
  "_next",
] as const

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

/** Saubere hierarchische Pfade: `/ueber-uns` oder `/kategorie/unterseite`. */
export function normalizeCmsPagePath(input: string): string {
  const raw = String(input ?? "").trim()
  if (!raw || raw === "/") return "/"
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`
  const parts = withSlash
    .split("/")
    .filter(Boolean)
    .map((part) => slugifyCmsPathSegment(part))
    .filter(Boolean)
    .slice(0, 6)
  return parts.length ? `/${parts.join("/")}` : "/"
}

export function isCmsReservedPath(path: string): boolean {
  const normalized = normalizeCmsPagePath(path)
  if (normalized === "/") return true
  const first = normalized.split("/").filter(Boolean)[0] ?? ""
  return (CMS_RESERVED_PATH_PREFIXES as readonly string[]).includes(first)
}

/** @deprecated Prefer normalizeCmsPagePath — kept for migration. */
export function customPagePathFromSlug(slug: string): string {
  const clean = slugifyCmsPathSegment(slug) || "seite"
  return `/${clean}`
}

export function slugFromCmsPagePath(path: string): string | null {
  const normalized = normalizeCmsPagePath(path)
  if (normalized === "/") return null
  const parts = normalized.split("/").filter(Boolean)
  if (parts[0] === "seiten" && parts[1]) {
    return parts.slice(1).join("-")
  }
  return parts.join("-") || null
}

function cleanString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
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

function sanitizeValueCards(input: unknown): CmsValueCard[] {
  if (!Array.isArray(input)) return []
  return input
    .map((raw, index) => {
      if (!isRecord(raw)) return null
      const title = cleanString(raw.title).trim()
      const description = cleanString(raw.description).trim()
      if (!title && !description) return null
      return {
        id:
          typeof raw.id === "string" && raw.id.trim()
            ? raw.id.trim()
            : `card-${index}`,
        icon: cleanString(raw.icon, "Sparkles").slice(0, 40) || "Sparkles",
        title: title || "Titel",
        description,
      }
    })
    .filter((card): card is CmsValueCard => card !== null)
    .slice(0, 6)
}

function sanitizeLayout(value: unknown): CmsPageColumnLayout {
  if (value === "2" || value === 2) return "2"
  if (value === "3" || value === 3) return "3"
  return "1"
}

export function sanitizeCmsPageRows(input: unknown): CmsPageRow[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [{ id: "row-default", layout: "1", sortOrder: 0 }]
  }
  return input
    .map((raw, index) => {
      if (!isRecord(raw)) return null
      const id =
        typeof raw.id === "string" && raw.id.trim()
          ? raw.id.trim()
          : `row-${index}`
      return {
        id,
        layout: sanitizeLayout(raw.layout),
        sortOrder:
          typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
            ? raw.sortOrder
            : index,
      }
    })
    .filter((row): row is CmsPageRow => row !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row, index) => ({ ...row, sortOrder: index }))
}

export function sanitizeCmsPageBlock(
  raw: unknown,
  index: number,
  fallbackRowId = "row-default"
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
  const rowId =
    typeof raw.rowId === "string" && raw.rowId.trim()
      ? raw.rowId.trim()
      : fallbackRowId
  const columnIndex = Math.max(
    0,
    Math.min(2, Number.isFinite(Number(raw.columnIndex)) ? Number(raw.columnIndex) : 0)
  )

  const base: CmsPageBlock = {
    id,
    type: type as CmsPageBlockType,
    sortOrder,
    rowId,
    columnIndex,
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
      return {
        ...base,
        showContactForm: raw.showContactForm !== false,
        ctaTitle: cleanString(
          raw.ctaTitle,
          "Schreib uns / Fragen & Sonderwünsche"
        ).slice(0, 200),
      }
    case "valueCards":
      return { ...base, cards: sanitizeValueCards(raw.cards) }
    case "cta":
      return {
        ...base,
        ctaTitle: cleanString(raw.ctaTitle).slice(0, 200),
        ctaButtonLabel: cleanString(raw.ctaButtonLabel, "Jetzt Kontakt aufnehmen").slice(
          0,
          80
        ),
        ctaButtonHref: cleanString(raw.ctaButtonHref, "/kontakt").slice(0, 200),
      }
    default:
      return base
  }
}

export function sanitizeCmsPageBlocks(
  input: unknown,
  rows?: CmsPageRow[]
): CmsPageBlock[] {
  const safeRows = rows?.length ? rows : sanitizeCmsPageRows(undefined)
  const fallbackRowId = safeRows[0]?.id ?? "row-default"
  if (!Array.isArray(input)) return []
  return input
    .map((block, index) => sanitizeCmsPageBlock(block, index, fallbackRowId))
    .filter((block): block is CmsPageBlock => block !== null)
    .map((block) => {
      const row = safeRows.find((entry) => entry.id === block.rowId) ?? safeRows[0]
      const maxCol = Number(row?.layout ?? "1") - 1
      return {
        ...block,
        rowId: row?.id ?? fallbackRowId,
        columnIndex: Math.min(block.columnIndex, Math.max(0, maxCol)),
      }
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((block, index) => ({ ...block, sortOrder: index }))
}

export function createEmptyCmsPageRow(
  layout: CmsPageColumnLayout = "1"
): CmsPageRow {
  return {
    id: makeId("row"),
    layout,
    sortOrder: 0,
  }
}

export function createEmptyCmsPageBlock(
  type: CmsPageBlockType,
  rowId = "row-default",
  columnIndex = 0
): CmsPageBlock {
  const id = makeId("block")
  const base = { id, type, sortOrder: 0, rowId, columnIndex }
  switch (type) {
    case "richtext":
      return { ...base, html: "<p></p>" }
    case "imageText":
      return {
        ...base,
        imageUrl: null,
        imageAlt: "",
        textHtml: "<p></p>",
        imagePosition: "left",
      }
    case "gallery":
      return { ...base, images: [] }
    case "faq":
      return {
        ...base,
        faqItems: [
          {
            id: makeId("faq"),
            question: "Neue Frage",
            answer: "",
          },
        ],
      }
    case "contact":
      return {
        ...base,
        showContactForm: true,
        ctaTitle: "Schreib uns / Fragen & Sonderwünsche",
      }
    case "valueCards":
      return {
        ...base,
        cards: [
          {
            id: makeId("card"),
            icon: "Sparkles",
            title: "Neuer Vorteil",
            description: "Kurzbeschreibung",
          },
        ],
      }
    case "cta":
      return {
        ...base,
        ctaTitle: "Hast du eine eigene Idee oder einen Sonderwunsch?",
        ctaButtonLabel: "Jetzt Kontakt aufnehmen",
        ctaButtonHref: "/kontakt",
      }
  }
}

export function sanitizeCmsCustomPageContent(
  input: Partial<CmsCustomPageContent> | Record<string, unknown> | null | undefined,
  fallbackSlug: string
): CmsCustomPageContent {
  const raw: Record<string, unknown> = isRecord(input) ? input : {}
  const pathRaw = typeof raw.path === "string" ? raw.path : ""
  const pathCandidate = pathRaw.trim() ? normalizeCmsPagePath(pathRaw) : ""
  const slugFromPath = pathCandidate ? slugFromCmsPagePath(pathCandidate) : null
  const slug =
    slugifyCmsPathSegment(cleanString(raw.slug, fallbackSlug)) ||
    slugFromPath ||
    slugifyCmsPathSegment(fallbackSlug) ||
    "seite"
  const rows = sanitizeCmsPageRows(raw.rows)
  return {
    slug,
    published: raw.published === true,
    heroTitle: cleanString(raw.heroTitle).slice(0, 160),
    heroSubtitle: cleanString(raw.heroSubtitle).slice(0, 320),
    bannerImageUrl:
      typeof raw.bannerImageUrl === "string" && raw.bannerImageUrl.trim()
        ? raw.bannerImageUrl.trim()
        : null,
    rows,
    blocks: sanitizeCmsPageBlocks(raw.blocks, rows),
  }
}

export function groupBlocksByRow(
  rows: CmsPageRow[],
  blocks: CmsPageBlock[]
): Array<{ row: CmsPageRow; columns: CmsPageBlock[][] }> {
  const orderedRows = [...rows].sort((a, b) => a.sortOrder - b.sortOrder)
  return orderedRows.map((row) => {
    const colCount = Number(row.layout)
    const columns: CmsPageBlock[][] = Array.from({ length: colCount }, () => [])
    blocks
      .filter((block) => block.rowId === row.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((block) => {
        const idx = Math.min(block.columnIndex, colCount - 1)
        columns[idx].push(block)
      })
    return { row, columns }
  })
}
