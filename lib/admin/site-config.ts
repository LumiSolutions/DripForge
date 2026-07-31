export type SiteConfigEnvironment = "staging" | "production"

export const SITE_CONFIG_DOC_TYPE = "site_config"
export const SITE_CONFIG_STAGING_ID = "site_config-staging"
export const SITE_CONFIG_PRODUCTION_ID = "site_config-production"
export const LEGACY_SITE_TEXTS_DOC_ID = "site-texts"

export const SITE_CONFIG_PREVIEW_PARAM = "preview"
export const SITE_CONFIG_PREVIEW_STORAGE_KEY = "dripforge_site_config_preview"
export const SITE_CONFIG_READONLY_PARAM = "readonly"
export const SITE_CONFIG_READONLY_STORAGE_KEY = "dripforge_site_config_readonly"

export function isSiteConfigPreviewEnabled(search: string): boolean {
  if (typeof window === "undefined") return false
  if (new URLSearchParams(search).get(SITE_CONFIG_PREVIEW_PARAM) === "true") return true
  try {
    return sessionStorage.getItem(SITE_CONFIG_PREVIEW_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function enableSiteConfigPreviewInSession(): void {
  try {
    sessionStorage.setItem(SITE_CONFIG_PREVIEW_STORAGE_KEY, "1")
  } catch {
    /* ignore */
  }
}

export function disableSiteConfigPreviewInSession(): void {
  try {
    sessionStorage.removeItem(SITE_CONFIG_PREVIEW_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function isSiteConfigReadonlyEnabled(search: string): boolean {
  if (typeof window === "undefined") return false
  const value = new URLSearchParams(search).get(SITE_CONFIG_READONLY_PARAM)
  if (value === "1" || value === "true") {
    enableSiteConfigReadonlyInSession()
    return true
  }
  if (value === "0" || value === "false") {
    disableSiteConfigReadonlyInSession()
    return false
  }
  try {
    return sessionStorage.getItem(SITE_CONFIG_READONLY_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function enableSiteConfigReadonlyInSession(): void {
  try {
    sessionStorage.setItem(SITE_CONFIG_READONLY_STORAGE_KEY, "1")
  } catch {
    /* ignore */
  }
}

export function disableSiteConfigReadonlyInSession(): void {
  try {
    sessionStorage.removeItem(SITE_CONFIG_READONLY_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
