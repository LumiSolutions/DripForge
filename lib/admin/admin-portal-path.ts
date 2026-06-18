/** Geheimer URL-Pfad zum Backoffice — nicht in öffentlichen Links verwenden. */
export const ADMIN_PORTAL_BASE_PATH = "/dripforgehq"

export function adminPortalPath(subpath = ""): string {
  if (!subpath || subpath === "/") return ADMIN_PORTAL_BASE_PATH
  const normalized = subpath.startsWith("/") ? subpath : `/${subpath}`
  return `${ADMIN_PORTAL_BASE_PATH}${normalized}`
}

/** Alte Backoffice-Pfade — leiten auf die Startseite um. */
export const LEGACY_ADMIN_PATH_PREFIXES = ["/admin", "/drip-forge-backoffice-2026"] as const

export function isLegacyAdminPath(pathname: string): boolean {
  return LEGACY_ADMIN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
