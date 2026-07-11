import {
  ADMIN_PORTAL_BASE_PATH,
  LEGACY_ADMIN_PATH_PREFIXES,
} from "@/lib/admin/admin-portal-path"

export const LAUNCH_GATE_BYPASS_PREFIXES = [
  ADMIN_PORTAL_BASE_PATH,
  ...LEGACY_ADMIN_PATH_PREFIXES,
  "/konto",
  "/konfigurator/ai",
]

export function isLaunchGateBypassPath(pathname: string): boolean {
  return LAUNCH_GATE_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
