"use client"

import { usePathname } from "next/navigation"
import { ShopFooter } from "@/components/dripforge/shop-footer"
import { isLaunchGateBypassPath } from "@/lib/dripforge/launch-gate-paths"
import { useLaunchGateStatus } from "@/hooks/use-launch-gate-status"

const HIDDEN_PREFIXES = [
  "/dripforgehq",
  "/drip-forge-backoffice-2026",
  "/admin/content",
  "/admin/preview",
]

function shouldHideFooter(pathname: string): boolean {
  if (pathname === "/admin") return true
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  if (pathname.startsWith("/admin/passwort")) return true
  return false
}

function shouldHideFooterForCountdown(
  pathname: string,
  loading: boolean,
  showGlobalCountdown: boolean,
  showPathCountdown: boolean
): boolean {
  if (isLaunchGateBypassPath(pathname)) return false
  if (loading) return true
  return showGlobalCountdown || showPathCountdown
}

export function GlobalShopFooter() {
  const pathname = usePathname() ?? "/"
  const { status, loading } = useLaunchGateStatus()

  if (shouldHideFooter(pathname)) {
    return null
  }

  if (
    shouldHideFooterForCountdown(
      pathname,
      loading,
      Boolean(status?.showGlobalCountdown),
      Boolean(status?.showPathCountdown)
    )
  ) {
    return null
  }

  return <ShopFooter />
}
