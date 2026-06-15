"use client"

import { Percent, Printer, Zap } from "lucide-react"
import type { ShopFilterId, ShopFilterOption } from "@/lib/dripforge/shop-filters"
import { cn } from "@/lib/utils"

type ShopMainFilterTabsProps = {
  options: ShopFilterOption[]
  activeId: ShopFilterId
  onChange: (id: ShopFilterId) => void
  className?: string
}

function shopFilterIcon(id: ShopFilterId) {
  switch (id) {
    case "3d":
      return Printer
    case "laser":
      return Zap
    case "sale":
      return Percent
    default:
      return null
  }
}

export function ShopMainFilterTabs({
  options,
  activeId,
  onChange,
  className,
}: ShopMainFilterTabsProps) {
  if (options.length <= 1) return null

  return (
    <nav
      aria-label="Hauptkategorien"
      className={cn(
        "flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/50 bg-card/40 p-2 sm:justify-start",
        className
      )}
    >
      {options.map((option) => {
        const Icon = shopFilterIcon(option.id)
        const isActive = activeId === option.id
        const isSale = option.id === "sale"

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
              isSale
                ? isActive
                  ? "bg-red-500 text-white shadow-sm hover:bg-red-500/90"
                  : "border border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:text-red-400"
                : isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            {option.label}
          </button>
        )
      })}
    </nav>
  )
}
