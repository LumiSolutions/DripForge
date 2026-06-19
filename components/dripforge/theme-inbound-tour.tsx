"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react"
import Image from "next/image"
import { createPortal } from "react-dom"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  hasSeenThemeInboundTour,
  markThemeInboundTourSeen,
  shouldUseUnoptimizedThemeTourImage,
  THEME_DRIP_OVERLAY_SRC,
} from "@/lib/dripforge/theme-inbound-tour-settings"
import {
  applySiteTheme,
  type SiteTheme,
} from "@/lib/dripforge/site-theme"
import {
  useThemeInboundTourEnabled,
  useThemeInboundTourSettings,
} from "@/hooks/use-theme-inbound-tour-enabled"

type AnchorPosition = {
  left: number
  top: number
}

function measureAnchor(anchor: HTMLElement | null): AnchorPosition | null {
  if (!anchor) return null
  const rect = anchor.getBoundingClientRect()
  return {
    left: rect.left + rect.width / 2,
    top: rect.bottom,
  }
}

function resolveSystemTheme(): SiteTheme {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

type ThemeInboundTourProps = {
  anchorRef: RefObject<HTMLElement | null>
  onThemeChange?: (theme: SiteTheme) => void
}

export function useThemeInboundTourVisible(): boolean {
  const enabled = useThemeInboundTourEnabled()
  const [seen, setSeen] = useState(true)

  useEffect(() => {
    setSeen(hasSeenThemeInboundTour())

    const syncSeen = () => setSeen(hasSeenThemeInboundTour())
    window.addEventListener("dripforge:theme-tour-seen", syncSeen)
    window.addEventListener("storage", syncSeen)

    return () => {
      window.removeEventListener("dripforge:theme-tour-seen", syncSeen)
      window.removeEventListener("storage", syncSeen)
    }
  }, [])

  if (enabled !== true || seen) return false
  return true
}

/** Erstbesucher-Onboarding: DripForge-Tropfen unter dem Theme-Switch in der Navbar. */
export function ThemeInboundTour({
  anchorRef,
  onThemeChange,
}: ThemeInboundTourProps) {
  const tourSettings = useThemeInboundTourSettings()
  const enabled = tourSettings?.enableThemeInboundTour ?? null
  const dripImageSrc =
    tourSettings?.themeInboundTourImageUrl ?? THEME_DRIP_OVERLAY_SRC
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [position, setPosition] = useState<AnchorPosition | null>(null)
  const exitTimerRef = useRef<number | null>(null)

  const closeWithTheme = useCallback(
    (theme: SiteTheme) => {
      if (exiting || !visible) return
      applySiteTheme(theme)
      onThemeChange?.(theme)
      setExiting(true)
      exitTimerRef.current = window.setTimeout(() => {
        markThemeInboundTourSeen()
        setVisible(false)
        setExiting(false)
      }, 320)
    },
    [exiting, onThemeChange, visible]
  )

  const dismissWithSystemTheme = useCallback(() => {
    closeWithTheme(resolveSystemTheme())
  }, [closeWithTheme])

  useEffect(() => {
    setMounted(true)
    return () => {
      if (exitTimerRef.current != null) {
        window.clearTimeout(exitTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const syncVisibility = () => {
      const shouldShow = enabled === true && !hasSeenThemeInboundTour()
      setVisible(shouldShow)
      if (!shouldShow) setExiting(false)
    }

    syncVisibility()
    window.addEventListener("dripforge:theme-tour-seen", syncVisibility)

    return () => {
      window.removeEventListener("dripforge:theme-tour-seen", syncVisibility)
    }
  }, [enabled])

  useLayoutEffect(() => {
    if (!visible || exiting) return

    const updatePosition = () => {
      setPosition(measureAnchor(anchorRef.current))
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [visible, exiting, anchorRef])

  if (!mounted || !visible || !position) {
    return null
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Theme-Hinweis schliessen"
        className={cn(
          "fixed inset-0 z-[300] bg-black/55 backdrop-blur-[1px] transition-opacity duration-300",
          exiting ? "opacity-0" : "opacity-100"
        )}
        onClick={dismissWithSystemTheme}
      />

      <div
        className={cn(
          "fixed z-[305] w-[min(18rem,calc(100vw-1.5rem))] max-w-[19rem]",
          exiting ? "theme-drip-exit" : "theme-drip-enter theme-drip-pulse"
        )}
        style={{
          left: position.left,
          top: position.top + 4,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-inbound-tour-title"
      >
        <div
          className={cn(
            "relative flex flex-col items-center transition-opacity duration-300",
            exiting && "opacity-0"
          )}
        >
          <div className="relative w-full">
            <Image
              src={dripImageSrc}
              alt=""
              width={280}
              height={340}
              priority
              unoptimized={shouldUseUnoptimizedThemeTourImage(dripImageSrc)}
              aria-hidden
              className="pointer-events-none mx-auto h-auto w-full max-w-[17rem] opacity-[0.88] drop-shadow-[0_18px_36px_rgba(249,115,22,0.35)] sm:max-w-[18rem]"
            />

            <div className="absolute inset-x-0 bottom-[12%] flex flex-col items-center gap-4 px-4 pb-1 pt-2 sm:bottom-[14%] sm:gap-3.5 sm:px-6 md:bottom-[15%]">
              <p
                id="theme-inbound-tour-title"
                className="text-center text-sm font-semibold leading-snug text-slate-900 sm:text-[0.95rem]"
              >
                Tag- oder Nachtmodus?
              </p>

              <div className="flex w-full flex-col gap-3 md:flex-row md:justify-center md:gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-auto min-h-11 w-full touch-manipulation border border-slate-300/80 bg-white/95 px-4 py-3.5 text-base font-medium text-foreground shadow-md hover:bg-white md:h-9 md:min-h-0 md:min-w-[7.25rem] md:flex-none md:py-2 md:text-sm"
                  onClick={() => closeWithTheme("light")}
                >
                  <Sun className="mr-2 h-4 w-4 shrink-0 text-amber-500" />
                  Tagmodus
                </Button>
                <Button
                  type="button"
                  className="h-auto min-h-11 w-full touch-manipulation border border-slate-700/40 bg-zinc-900/95 px-4 py-3.5 text-base font-medium text-white shadow-md hover:bg-zinc-900 md:h-9 md:min-h-0 md:min-w-[7.25rem] md:flex-none md:py-2 md:text-sm"
                  onClick={() => closeWithTheme("dark")}
                >
                  <Moon className="mr-2 h-4 w-4 shrink-0 text-sky-300" />
                  Nachtmodus
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
