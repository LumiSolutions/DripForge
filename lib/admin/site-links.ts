import type { SiteTextKey } from "@/lib/admin/site-texts"
import { SHOP_ROUTES } from "@/lib/dripforge/shop-routes"

export type SiteLinkEntry = {
  href: string
}

/** Default Ziel-URLs für CTA-/Button-Texte (Key = SiteTextKey). */
export const DEFAULT_SITE_LINKS: Partial<Record<SiteTextKey, SiteLinkEntry>> = {
  landingpage_hero_cta_primary: { href: SHOP_ROUTES.shop },
  landingpage_hero_cta_secondary: { href: SHOP_ROUTES.shop },
  landingpage_expertise_3d_cta: { href: SHOP_ROUTES["3d-druck"] },
  landingpage_expertise_laser_cta: { href: SHOP_ROUTES.laser },
  landingpage_ai_cta: { href: SHOP_ROUTES.aiKonfigurator },
  landingpage_cta_button_upload: { href: SHOP_ROUTES.shop },
  landingpage_cta_button_contact: { href: SHOP_ROUTES.kontakt },
  chat_contact_link: { href: SHOP_ROUTES.kontakt },
}

export type SiteLinks = Partial<Record<string, SiteLinkEntry>>

export function isHrefEditableSiteTextKey(key: string): boolean {
  if (key in DEFAULT_SITE_LINKS) return true
  const lower = key.toLowerCase()
  return lower.includes("cta") || lower.includes("button")
}

export function getDefaultSiteLinkHref(key: string): string | null {
  const entry = DEFAULT_SITE_LINKS[key as SiteTextKey]
  return entry?.href ?? null
}

export function mergeSiteLinks(
  partial: SiteLinks | null | undefined
): SiteLinks {
  const merged: SiteLinks = {}
  for (const [key, entry] of Object.entries(DEFAULT_SITE_LINKS)) {
    if (entry) merged[key] = { href: entry.href }
  }
  if (!partial) return merged
  for (const [key, entry] of Object.entries(partial)) {
    if (!entry || typeof entry !== "object") continue
    const href = typeof entry.href === "string" ? entry.href.trim() : ""
    if (href) merged[key] = { href }
  }
  return merged
}

export function sanitizeSiteLinksInput(
  input: SiteLinks | null | undefined
): SiteLinks {
  if (!input || typeof input !== "object") return mergeSiteLinks(null)
  const sanitized: SiteLinks = {}
  for (const [key, entry] of Object.entries(input)) {
    if (!key || !entry || typeof entry !== "object") continue
    const href = typeof entry.href === "string" ? entry.href.trim() : ""
    if (href) sanitized[key] = { href }
  }
  // Keep defaults for missing editable keys so consumers always resolve a href.
  return mergeSiteLinks(sanitized)
}

export function resolveSiteLinkHref(
  links: SiteLinks | null | undefined,
  key: string,
  fallback?: string | null
): string {
  const fromConfig = links?.[key]?.href?.trim()
  if (fromConfig) return fromConfig
  const fromDefault = getDefaultSiteLinkHref(key)
  if (fromDefault) return fromDefault
  return fallback?.trim() || "/"
}
