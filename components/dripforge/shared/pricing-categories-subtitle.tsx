"use client"

import { useEffect, useState } from "react"
import {
  createDefaultLaserCategories,
  createDefaultPrint3dCategories,
  formatPricingCategoriesSubtitle,
  type IndividualPricingCategory,
} from "@/lib/admin/individual-pricing-types"
import { cn } from "@/lib/utils"

type PricingCategoriesSubtitleProps = {
  service: "print3d" | "laser"
  className?: string
}

export function PricingCategoriesSubtitle({
  service,
  className,
}: PricingCategoriesSubtitleProps) {
  const [categories, setCategories] = useState<IndividualPricingCategory[]>(
    () =>
      service === "laser"
        ? createDefaultLaserCategories()
        : createDefaultPrint3dCategories()
  )

  useEffect(() => {
    let cancelled = false
    void fetch("/api/settings/individual-pricing", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const next = data[service]?.categories
        if (Array.isArray(next) && next.length > 0) {
          setCategories(next)
        }
      })
      .catch(() => {
        /* Defaults bleiben */
      })
    return () => {
      cancelled = true
    }
  }, [service])

  const text = formatPricingCategoriesSubtitle(categories)
  if (!text) return null

  return (
    <p
      className={cn(
        "text-[11px] leading-relaxed text-muted-foreground/90 sm:text-xs",
        className
      )}
    >
      {text}
    </p>
  )
}
