import { CMS_PREVIEW_PAGES } from "@/lib/admin/cms-preview-pages"
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
  const path =
    typeof raw.path === "string" && raw.path.trim()
      ? raw.path.trim()
      : `/${id}`
  const sortOrder =
    typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
      ? raw.sortOrder
      : index
  return {
    id,
    title,
    path,
    enabled: raw.enabled !== false,
    sortOrder,
    system: raw.system === true,
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

export function mergeCmsPages(input: unknown): CmsPageEntry[] {
  if (input == null) return getDefaultCmsPages()
  return sanitizeCmsPagesInput(input)
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
