"use client"

import { usePathname } from "next/navigation"
import { ShopFooter } from "@/components/dripforge/shop-footer"

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

export function GlobalShopFooter() {
  const pathname = usePathname()

  if (shouldHideFooter(pathname)) {
    return null
  }

  return <ShopFooter />
}
