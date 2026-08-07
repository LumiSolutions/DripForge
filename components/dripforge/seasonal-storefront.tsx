"use client"

import { useEffect, useMemo, useState } from "react"
import type { Product } from "@/lib/dripforge/types"
import {
  normalizeSeasonalSettings,
  resolveActiveSeasonalEvent,
  type SeasonalEvent,
  type SeasonalSettings,
} from "@/lib/dripforge/seasonal-events"

type SeasonalPayload = {
  seasonal?: SeasonalSettings | null
  activeEvent?: SeasonalEvent | null
}

export function useSeasonalEvent() {
  const [seasonal, setSeasonal] = useState<SeasonalSettings>(() =>
    normalizeSeasonalSettings(undefined)
  )
  const [activeEvent, setActiveEvent] = useState<SeasonalEvent | null>(null)

  useEffect(() => {
    void fetch("/api/settings/seasonal-event", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SeasonalPayload | null) => {
        const next = normalizeSeasonalSettings(data?.seasonal)
        setSeasonal(next)
        setActiveEvent(data?.activeEvent ?? resolveActiveSeasonalEvent(next))
      })
      .catch(() => {
        setSeasonal(normalizeSeasonalSettings(undefined))
        setActiveEvent(null)
      })
  }, [])

  return { seasonal, activeEvent }
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
  const items = useMemo(() => Array.from({ length: 14 }, (_, index) => index), [])
  if (!event || event.effect === "none") return null

  const glyph =
    event.effect === "snow"
      ? "❄"
      : event.effect === "hearts"
        ? "♥"
        : event.effect === "spooky"
          ? "✦"
          : "•"

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-40 overflow-hidden opacity-60 motion-reduce:hidden">
      {items.map((item) => (
        <span
          key={item}
          className="absolute -top-6 animate-seasonal-fall text-sm"
          style={{
            left: `${(item * 7 + 5) % 100}%`,
            color: event.accentColor,
            animationDelay: `${item * 0.35}s`,
            animationDuration: `${6 + (item % 5)}s`,
          }}
        >
          {glyph}
        </span>
      ))}
      <style jsx>{`
        @keyframes seasonal-fall {
          0% {
            transform: translateY(-1rem) rotate(0deg);
            opacity: 0;
          }
          15% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(11rem) rotate(120deg);
            opacity: 0;
          }
        }
        .animate-seasonal-fall {
          animation-name: seasonal-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  )
}
