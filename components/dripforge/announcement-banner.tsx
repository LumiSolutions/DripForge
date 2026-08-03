"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  DEFAULT_ANNOUNCEMENT_BANNER,
  getActiveAnnouncementEntries,
  normalizeAnnouncementBanner,
  type AnnouncementBannerEntry,
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

/** Textsegment + optionaler Rabattcode; optional als Link umschlossen. */
function EntryContent({ entry }: { entry: AnnouncementBannerEntry }) {
  const inner = (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span>{entry.text}</span>
      {entry.discountCode.trim() ? (
        <span className="rounded-md bg-black/20 px-2 py-0.5 font-mono text-xs tracking-wide">
          {entry.discountCode.trim()}
        </span>
      ) : null}
    </span>
  )

  const href = entry.linkUrl.trim()
  if (!href) return inner

  const external = /^https?:\/\//i.test(href)
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline"
      >
        {inner}
      </a>
    )
  }
  return (
    <Link href={href} className="underline-offset-2 hover:underline">
      {inner}
    </Link>
  )
}

/**
 * Globale Ankündigungsleiste — nur öffentlicher Storefront, über dem Shop-Header.
 * Unterstützt mehrere zeitlich begrenzte Texte im Lauftext- (Marquee) oder
 * Rotations-Modus.
 */
export function AnnouncementBanner() {
  const pathname = usePathname() ?? "/"
  const [banner, setBanner] = useState<AnnouncementBannerSettings | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [rotateIndex, setRotateIndex] = useState(0)
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
          setBanner(normalizeAnnouncementBanner(data))
        }
      } catch {
        if (!cancelled) setBanner(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Zeitfenster regelmässig neu auswerten, damit ablaufende/startende Texte
  // ohne Reload erscheinen bzw. verschwinden.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(interval)
  }, [])

  const activeEntries = useMemo(
    () => (banner ? getActiveAnnouncementEntries(banner, now) : []),
    [banner, now]
  )

  const displayMode = banner?.displayMode ?? DEFAULT_ANNOUNCEMENT_BANNER.displayMode
  const rotateSeconds = banner?.rotateSeconds ?? DEFAULT_ANNOUNCEMENT_BANNER.rotateSeconds

  // Rotationsmodus: aktiven Text zyklisch wechseln.
  useEffect(() => {
    setRotateIndex(0)
  }, [activeEntries.length, displayMode])

  useEffect(() => {
    if (displayMode !== "rotate" || activeEntries.length <= 1) return
    const interval = setInterval(() => {
      setRotateIndex((prev) => (prev + 1) % activeEntries.length)
    }, Math.max(2, rotateSeconds) * 1000)
    return () => clearInterval(interval)
  }, [displayMode, activeEntries.length, rotateSeconds])

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
  }, [pathname, activeEntries.length, displayMode, rotateIndex])

  if (isAdminPath(pathname)) return null
  if (!banner || activeEntries.length === 0) return null

  const className = cn(
    "fixed inset-x-0 top-0 z-[110] w-full overflow-hidden",
    banner.style === "animated-gradient" && "df-announcement-gradient"
  )
  const style =
    banner.style === "unicolor"
      ? { backgroundColor: banner.backgroundColor || "#ea580c" }
      : undefined

  const setRef = (node: HTMLElement | null) => {
    rootRef.current = node
  }

  const body =
    displayMode === "marquee" ? (
      <div className="df-marquee-viewport py-2 text-sm font-medium text-white">
        {/* Zwei Tracks für nahtlose Endlos-Schleife */}
        <div className="df-marquee-track" aria-hidden={false}>
          {activeEntries.map((entry) => (
            <span key={entry.id} className="df-marquee-item">
              <EntryContent entry={entry} />
            </span>
          ))}
        </div>
        <div className="df-marquee-track" aria-hidden>
          {activeEntries.map((entry) => (
            <span key={`dup-${entry.id}`} className="df-marquee-item">
              <EntryContent entry={entry} />
            </span>
          ))}
        </div>
      </div>
    ) : (
      <div
        key={activeEntries[rotateIndex % activeEntries.length]?.id}
        className="df-announcement-rotate mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm font-medium text-white"
      >
        <EntryContent
          entry={activeEntries[rotateIndex % activeEntries.length]!}
        />
      </div>
    )

  return (
    <div ref={setRef} className={className} style={style} role="status">
      {body}
    </div>
  )
}
