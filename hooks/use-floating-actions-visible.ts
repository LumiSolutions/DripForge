"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import {
  ADMIN_PORTAL_BASE_PATH,
  LEGACY_ADMIN_PATH_PREFIXES,
} from "@/lib/admin/admin-portal-path"

function isAdminPortalPath(pathname: string): boolean {
  if (
    pathname === ADMIN_PORTAL_BASE_PATH ||
    pathname.startsWith(`${ADMIN_PORTAL_BASE_PATH}/`)
  ) {
    return true
  }
  return LEGACY_ADMIN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

type LaunchApiPayload = {
  canAccessShop?: boolean
  shopLive?: boolean
  hasPreviewAccess?: boolean
}

function parseCanAccessShop(data: LaunchApiPayload | null): boolean {
  if (!data) return false
  const hasPreviewAccess = Boolean(data.hasPreviewAccess)
  const shopLive = Boolean(data.shopLive)
  return Boolean(data.canAccessShop) || hasPreviewAccess || shopLive
}

/**
 * Schwebendes Chat-/Support-Widget anzeigen?
 * Nur öffentlicher Webshop — Admin (/dripforgehq) und Countdown ausgeblendet.
 */
export function useFloatingActionsVisible(): boolean {
  const pathname = usePathname()
  const [canAccessShop, setCanAccessShop] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/settings/launch", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LaunchApiPayload | null) => {
        if (!cancelled) {
          setCanAccessShop(parseCanAccessShop(data))
        }
      })
      .catch(() => {
        if (!cancelled) setCanAccessShop(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Admin-HQ: kein Kunden-Chat-Widget
  if (isAdminPortalPath(pathname ?? "")) return false

  if (canAccessShop === false) return false

  return true
}
