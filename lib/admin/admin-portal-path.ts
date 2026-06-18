/** Geheimer URL-Pfad zum Backoffice — nicht in öffentlichen Links verwenden. */
export const ADMIN_PORTAL_BASE_PATH = "/drip-forge-backoffice-2026"

export function adminPortalPath(subpath = ""): string {
  if (!subpath || subpath === "/") return ADMIN_PORTAL_BASE_PATH
  const normalized = subpath.startsWith("/") ? subpath : `/${subpath}`
  return `${ADMIN_PORTAL_BASE_PATH}${normalized}`
}

/** Legacy-Pfade, die nicht mehr erreichbar sein sollen. */
export const LEGACY_ADMIN_PATH_PREFIX = "/admin"

export function isLegacyAdminPath(pathname: string): boolean {
  return pathname === LEGACY_ADMIN_PATH_PREFIX || pathname.startsWith(`${LEGACY_ADMIN_PATH_PREFIX}/`)
}
