"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  DEFAULT_ANNOUNCEMENT_BANNER,
  type AnnouncementBannerSettings,
} from "@/lib/dripforge/announcement-banner-settings"
import {
  ADMIN_PORTAL_BASE_PATH,
  LEGACY_ADMIN_PATH_PREFIXES,
} from "@/lib/admin/admin-portal-path"
import { cn } from "@/lib/utils"

function isAdminPath(pathname: string): boolean {
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

/**
 * Globale Ankündigungsleiste — nur öffentlicher Storefront, über dem Shop-Header.
 */
export function AnnouncementBanner() {
  const pathname = usePathname() ?? "/"
  const [banner, setBanner] = useState<AnnouncementBannerSettings | null>(null)
  const rootRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/settings/announcement-banner", {
          cache: "no-store",
        })
        const data = (await res.json()) as Partial<AnnouncementBannerSettings>
        if (!cancelled) {
          setBanner({
            ...DEFAULT_ANNOUNCEMENT_BANNER,
            ...data,
            active: data.active === true,
            style:
              data.style === "animated-gradient"
                ? "animated-gradient"
                : "unicolor",
          })
        }
      } catch {
        if (!cancelled) setBanner(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Banner-Höhe an den fixen Shop-Header weitergeben
  useEffect(() => {
    const el = rootRef.current
    if (!el || isAdminPath(pathname)) {
      document.documentElement.style.setProperty("--df-banner-h", "0px")
      return
    }
    const sync = () => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty(
        "--df-banner-h",
        `${Math.max(0, Math.round(h))}px`
      )
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.setProperty("--df-banner-h", "0px")
    }
  }, [banner, pathname])

  // Nicht im Admin-HQ anzeigen
  if (isAdminPath(pathname)) return null
  if (!banner?.active || !banner.text.trim()) return null

  const content = (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm font-medium text-white">
      <span>{banner.text}</span>
      {banner.discountCode.trim() ? (
        <span className="rounded-md bg-black/20 px-2 py-0.5 font-mono text-xs tracking-wide">
          {banner.discountCode.trim()}
        </span>
      ) : null}
    </div>
  )

  const className = cn(
    "fixed inset-x-0 top-0 z-[110] w-full",
    banner.style === "animated-gradient" && "df-announcement-gradient"
  )

  const style =
    banner.style === "unicolor"
      ? { backgroundColor: banner.backgroundColor || "#ea580c" }
      : undefined

  const setRef = (node: HTMLElement | null) => {
    rootRef.current = node
  }

  if (banner.linkUrl.trim()) {
    const href = banner.linkUrl.trim()
    const external = /^https?:\/\//i.test(href)
    if (external) {
      return (
        <a
          ref={setRef}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          style={style}
        >
          {content}
        </a>
      )
    }
    return (
      <Link ref={setRef} href={href} className={className} style={style}>
        {content}
      </Link>
    )
  }

  return (
    <div ref={setRef} className={className} style={style} role="status">
      {content}
    </div>
  )
}
