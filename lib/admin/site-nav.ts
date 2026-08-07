import { CMS_PREVIEW_PAGES } from "@/lib/admin/cms-preview-pages"
import {
  customPagePathFromSlug,
  sanitizeCmsCustomPageContent,
  sanitizeCmsPageBlocks,
  slugFromCmsPagePath,
  slugifyCmsPathSegment,
  type CmsPageBlock,
} from "@/lib/admin/cms-custom-pages"
import { navItems as HARDCODED_NAV } from "@/lib/dripforge/data"
import { shopNavHref } from "@/lib/dripforge/shop-routes"

export type CmsNavItem = {
  id: string
  label: string
  href: string
  enabled: boolean
  sortOrder: number
  icon?: string
}

export type CmsPageEntry = {
  id: string
  title: string
  path: string
  enabled: boolean
  sortOrder: number
  system?: boolean
  /** Custom pages under /seiten/[slug] */
  slug?: string
  /** false = Entwurf (nicht öffentlich) */
  published?: boolean
  heroTitle?: string
  heroSubtitle?: string
  bannerImageUrl?: string | null
  blocks?: CmsPageBlock[]
}

/** Lucide icon names selectable in CMS nav editor. */
export const CMS_NAV_ICON_OPTIONS = [
  "Home",
  "ShoppingBag",
  "Printer",
  "Zap",
  "MessageSquare",
  "HelpCircle",
  "Sparkles",
  "HeartHandshake",
  "Box",
  "Layers",
  "Settings",
  "Info",
] as const

export type CmsNavIconName = (typeof CMS_NAV_ICON_OPTIONS)[number]

const NAV_ICON_BY_ID: Record<string, string> = {
  home: "Home",
  "3d-druck": "Printer",
  laser: "Zap",
  shop: "ShoppingBag",
  kontakt: "MessageSquare",
}

export function getDefaultCmsNavItems(): CmsNavItem[] {
  return HARDCODED_NAV.map((item, index) => ({
    id: item.id,
    label: item.label,
    href: shopNavHref(item.id),
    enabled: true,
    sortOrder: index,
    icon: NAV_ICON_BY_ID[item.id] ?? "Home",
  }))
}

export function getDefaultCmsPages(): CmsPageEntry[] {
  return CMS_PREVIEW_PAGES.map((page, index) => ({
    id: page.id,
    title: page.label,
    path: page.path,
    enabled: true,
    sortOrder: index,
    system: true,
  }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function sanitizeNavItem(raw: unknown, index: number): CmsNavItem | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `nav-${index}`
  const label =
    typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : id
  const href =
    typeof raw.href === "string" && raw.href.trim()
      ? raw.href.trim()
      : shopNavHref(id)
  const icon =
    typeof raw.icon === "string" && raw.icon.trim() ? raw.icon.trim() : undefined
  const sortOrder =
    typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
      ? raw.sortOrder
      : index
  return {
    id,
    label,
    href,
    enabled: raw.enabled !== false,
    sortOrder,
    ...(icon ? { icon } : {}),
  }
}

function sanitizePageEntry(raw: unknown, index: number): CmsPageEntry | null {
  if (!isRecord(raw)) return null
  const id =
    typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `page-${index}`
  const title =
    typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : id
  const system = raw.system === true
  const pathFromInput =
    typeof raw.path === "string" && raw.path.trim() ? raw.path.trim() : ""
  const slugFromInput =
    typeof raw.slug === "string" && raw.slug.trim()
      ? slugifyCmsPathSegment(raw.slug)
      : ""
  const slugFromPath = pathFromInput ? slugFromCmsPagePath(pathFromInput) : null
  const slug =
    slugFromInput ||
    slugFromPath ||
    (!system ? slugifyCmsPathSegment(id.replace(/^custom-/, "") || title) : "")
  const path = system
    ? pathFromInput || `/${id}`
    : customPagePathFromSlug(slug || id)
  const sortOrder =
    typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
      ? raw.sortOrder
      : index
  const content = system
    ? null
    : sanitizeCmsCustomPageContent(
        {
          slug,
          published: raw.published === true,
          heroTitle: raw.heroTitle,
          heroSubtitle: raw.heroSubtitle,
          bannerImageUrl: raw.bannerImageUrl,
          blocks: sanitizeCmsPageBlocks(raw.blocks),
        },
        slug || id
      )
  return {
    id,
    title,
    path,
    enabled: raw.enabled !== false,
    sortOrder,
    system,
    ...(content
      ? {
          slug: content.slug,
          published: content.published,
          heroTitle: content.heroTitle,
          heroSubtitle: content.heroSubtitle,
          bannerImageUrl: content.bannerImageUrl,
          blocks: content.blocks,
        }
      : {}),
  }
}

export function sanitizeCmsNavItemsInput(input: unknown): CmsNavItem[] {
  if (!Array.isArray(input)) return getDefaultCmsNavItems()
  const items = input
    .map((item, index) => sanitizeNavItem(item, index))
    .filter((item): item is CmsNavItem => item !== null)
  if (items.length === 0) return getDefaultCmsNavItems()
  return items
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({ ...item, sortOrder: index }))
}

export function sanitizeCmsPagesInput(input: unknown): CmsPageEntry[] {
  if (!Array.isArray(input)) return getDefaultCmsPages()
  const pages = input
    .map((page, index) => sanitizePageEntry(page, index))
    .filter((page): page is CmsPageEntry => page !== null)
  if (pages.length === 0) return getDefaultCmsPages()
  return pages
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((page, index) => ({ ...page, sortOrder: index }))
}

export function mergeCmsNavItems(input: unknown): CmsNavItem[] {
  if (input == null) return getDefaultCmsNavItems()
  return sanitizeCmsNavItemsInput(input)
}

function normalizeCmsPath(path: string): string {
  if (!path || path === "/") return "/"
  return path.replace(/\/+$/, "") || "/"
}

/**
 * Merged Standard-Seiten mit gespeicherten Einträgen.
 * System-Seiten bleiben immer vorhanden (auch wenn Staging unvollständig ist).
 */
export function mergeCmsPages(input: unknown): CmsPageEntry[] {
  const defaults = getDefaultCmsPages()
  if (input == null) return defaults

  const byId = new Map<string, CmsPageEntry>()
  const pathToId = new Map<string, string>()
  for (const page of defaults) {
    byId.set(page.id, { ...page })
    pathToId.set(normalizeCmsPath(page.path), page.id)
  }

  if (!Array.isArray(input)) {
    return [...byId.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((page, index) => ({ ...page, sortOrder: index }))
  }

  input.forEach((raw, index) => {
    const page = sanitizePageEntry(raw, index)
    if (!page) return
    const pathKey = normalizeCmsPath(page.path)
    const existingId = byId.has(page.id)
      ? page.id
      : pathToId.get(pathKey)
    if (existingId) {
      const existing = byId.get(existingId)!
      const mergedSystem = existing.system || page.system
      byId.set(existingId, {
        ...existing,
        title: page.title || existing.title,
        path: mergedSystem ? existing.path : page.path,
        enabled: page.enabled,
        sortOrder: page.sortOrder,
        system: mergedSystem,
        ...(mergedSystem
          ? {
              slug: undefined,
              published: undefined,
              heroTitle: undefined,
              heroSubtitle: undefined,
              bannerImageUrl: undefined,
              blocks: undefined,
            }
          : {
              slug: page.slug ?? existing.slug,
              published: page.published ?? existing.published ?? false,
              heroTitle: page.heroTitle ?? existing.heroTitle ?? "",
              heroSubtitle: page.heroSubtitle ?? existing.heroSubtitle ?? "",
              bannerImageUrl:
                page.bannerImageUrl !== undefined
                  ? page.bannerImageUrl
                  : existing.bannerImageUrl ?? null,
              blocks: page.blocks ?? existing.blocks ?? [],
            }),
      })
      return
    }
    byId.set(page.id, page)
    pathToId.set(pathKey, page.id)
  })

  return [...byId.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((page, index) => ({ ...page, sortOrder: index }))
}

/** Enabled nav items sorted for storefront header. */
export function resolveVisibleCmsNavItems(items: CmsNavItem[] | null | undefined): CmsNavItem[] {
  return mergeCmsNavItems(items)
    .filter((item) => item.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Enabled CMS pages for preview navigator. */
export function resolveVisibleCmsPages(pages: CmsPageEntry[] | null | undefined): CmsPageEntry[] {
  return mergeCmsPages(pages)
    .filter((page) => page.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Öffentlich erreichbare Custom-Seiten (veröffentlicht + aktiv). */
export function resolvePublishedCustomCmsPages(
  pages: CmsPageEntry[] | null | undefined
): CmsPageEntry[] {
  return mergeCmsPages(pages).filter(
    (page) =>
      !page.system &&
      page.enabled &&
      page.published === true &&
      Boolean(page.slug?.trim())
  )
}

export function findCustomCmsPageBySlug(
  pages: CmsPageEntry[] | null | undefined,
  slug: string,
  options?: { includeDrafts?: boolean }
): CmsPageEntry | null {
  const wanted = slugifyCmsPathSegment(slug)
  if (!wanted) return null
  const match = mergeCmsPages(pages).find(
    (page) =>
      !page.system &&
      (page.slug === wanted || slugFromCmsPagePath(page.path) === wanted)
  )
  if (!match) return null
  if (!options?.includeDrafts) {
    if (!match.enabled || match.published !== true) return null
  }
  return match
}

/** Alle CMS-Seiten für den In-Context-Editor (auch deaktivierte). */
export function resolveCmsEditorPages(pages: CmsPageEntry[] | null | undefined): CmsPageEntry[] {
  return mergeCmsPages(pages).sort((a, b) => a.sortOrder - b.sortOrder)
}
