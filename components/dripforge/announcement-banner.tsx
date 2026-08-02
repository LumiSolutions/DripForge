"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  DEFAULT_ANNOUNCEMENT_BANNER,
  type AnnouncementBannerSettings,
} from "@/lib/dripforge/announcement-banner-settings"
import { cn } from "@/lib/utils"

export function AnnouncementBanner() {
  const [banner, setBanner] = useState<AnnouncementBannerSettings | null>(null)

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
    "relative z-[60] w-full",
    banner.style === "animated-gradient" && "df-announcement-gradient"
  )

  const style =
    banner.style === "unicolor"
      ? { backgroundColor: banner.backgroundColor || "#ea580c" }
      : undefined

  if (banner.linkUrl.trim()) {
    const href = banner.linkUrl.trim()
    const external = /^https?:\/\//i.test(href)
    if (external) {
      return (
        <a
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
      <Link href={href} className={className} style={style}>
        {content}
      </Link>
    )
  }

  return (
    <div className={className} style={style} role="status">
      {content}
    </div>
  )
}
