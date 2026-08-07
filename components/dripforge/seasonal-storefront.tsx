"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Product } from "@/lib/dripforge/types"
import {
  normalizeSeasonalSettings,
  resolveActiveSeasonalEvent,
  resolveSeasonalGlyphs,
  type SeasonalEvent,
  type SeasonalSettings,
} from "@/lib/dripforge/seasonal-events"
import { cn } from "@/lib/utils"

type SeasonalPayload = {
  seasonal?: SeasonalSettings | null
  activeEvent?: SeasonalEvent | null
}

type SeasonalContextValue = {
  seasonal: SeasonalSettings
  activeEvent: SeasonalEvent | null
  loaded: boolean
}

const SeasonalContext = createContext<SeasonalContextValue | null>(null)

export function SeasonalProvider({ children }: { children: ReactNode }) {
  const [seasonal, setSeasonal] = useState<SeasonalSettings>(() =>
    normalizeSeasonalSettings(undefined)
  )
  const [activeEvent, setActiveEvent] = useState<SeasonalEvent | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/settings/seasonal-event", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SeasonalPayload | null) => {
        if (cancelled) return
        const next = normalizeSeasonalSettings(data?.seasonal)
        setSeasonal(next)
        setActiveEvent(data?.activeEvent ?? resolveActiveSeasonalEvent(next))
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setSeasonal(normalizeSeasonalSettings(undefined))
        setActiveEvent(null)
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({ seasonal, activeEvent, loaded }),
    [seasonal, activeEvent, loaded]
  )

  return (
    <SeasonalContext.Provider value={value}>
      {children}
      <SeasonalEffects event={activeEvent} />
    </SeasonalContext.Provider>
  )
}

export function useSeasonalEvent() {
  const ctx = useContext(SeasonalContext)
  const [fallbackSeasonal, setFallbackSeasonal] = useState<SeasonalSettings>(() =>
    normalizeSeasonalSettings(undefined)
  )
  const [fallbackEvent, setFallbackEvent] = useState<SeasonalEvent | null>(null)

  useEffect(() => {
    if (ctx) return
    let cancelled = false
    void fetch("/api/settings/seasonal-event", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SeasonalPayload | null) => {
        if (cancelled) return
        const next = normalizeSeasonalSettings(data?.seasonal)
        setFallbackSeasonal(next)
        setFallbackEvent(data?.activeEvent ?? resolveActiveSeasonalEvent(next))
      })
      .catch(() => {
        if (cancelled) return
        setFallbackSeasonal(normalizeSeasonalSettings(undefined))
        setFallbackEvent(null)
      })
    return () => {
      cancelled = true
    }
  }, [ctx])

  if (ctx) return ctx
  return {
    seasonal: fallbackSeasonal,
    activeEvent: fallbackEvent,
    loaded: false,
  }
}

export function limitedProductsForEvent(
  products: Product[],
  event: SeasonalEvent | null
): Product[] {
  if (!event) return []
  return products.filter(
    (product) => product.limitedEdition && product.seasonalEventId === event.id
  )
}

export function seasonalBadgeForProduct(
  product: Product,
  event: SeasonalEvent | null
): { label: string | null; accentColor: string | null } {
  if (
    !event ||
    !product.limitedEdition ||
    product.seasonalEventId !== event.id
  ) {
    return { label: null, accentColor: null }
  }
  return {
    label: event.badgeLabel?.trim() || "Limited Edition",
    accentColor: event.accentColor?.trim() || null,
  }
}

export function SeasonalEffects({ event }: { event: SeasonalEvent | null }) {
  const density =
    event?.effect === "custom"
      ? event.customParticles?.density ?? 18
      : event?.effect === "fireworks"
        ? 22
        : 16
  const items = useMemo(
    () => Array.from({ length: density }, (_, index) => index),
    [density]
  )

  if (!event || event.effect === "none") return null

  const glyphs = resolveSeasonalGlyphs(event)
  const speed =
    event.effect === "custom" ? event.customParticles?.speed ?? 1 : 1
  const color =
    event.effect === "custom"
      ? event.customParticles?.color || event.accentColor
      : event.accentColor

  const isBlackFriday = event.effect === "blackFriday"
  const isFireworks = event.effect === "fireworks"

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-30 overflow-hidden motion-reduce:hidden",
        isBlackFriday && "mix-blend-screen"
      )}
      aria-hidden
    >
      {items.map((item) => {
        const glyph = glyphs[item % glyphs.length] ?? "•"
        const left = (item * 7 + 5) % 100
        const delay = (item * 0.28) / speed
        const duration = (5.5 + (item % 6)) / speed
        return (
          <span
            key={item}
            className={cn(
              "absolute text-sm opacity-70",
              isFireworks ? "animate-seasonal-burst" : "animate-seasonal-fall",
              isBlackFriday && "animate-seasonal-glitch font-bold tracking-tight"
            )}
            style={{
              left: `${left}%`,
              top: isFireworks ? `${20 + (item % 50)}%` : undefined,
              color,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              textShadow: isBlackFriday
                ? `0 0 8px ${color}, 0 0 16px ${color}`
                : undefined,
            }}
          >
            {glyph}
          </span>
        )
      })}
      <style jsx>{`
        @keyframes seasonal-fall {
          0% {
            transform: translateY(-2rem) rotate(0deg);
            opacity: 0;
          }
          12% {
            opacity: 0.85;
          }
          100% {
            transform: translateY(110vh) rotate(140deg);
            opacity: 0;
          }
        }
        @keyframes seasonal-burst {
          0% {
            transform: scale(0.4) translateY(0);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: scale(1.4) translateY(-4rem);
            opacity: 0;
          }
        }
        @keyframes seasonal-glitch {
          0%,
          100% {
            filter: none;
            transform: translateX(0);
          }
          40% {
            filter: hue-rotate(40deg);
            transform: translateX(1px);
          }
          60% {
            filter: hue-rotate(-30deg);
            transform: translateX(-1px);
          }
        }
        .animate-seasonal-fall {
          animation-name: seasonal-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .animate-seasonal-burst {
          animation-name: seasonal-burst;
          animation-timing-function: ease-out;
          animation-iteration-count: infinite;
        }
        .animate-seasonal-glitch {
          animation-name: seasonal-glitch;
          animation-duration: 1.2s;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  )
}
