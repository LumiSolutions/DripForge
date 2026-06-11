"use client"

import type { FilamentColor } from "@/lib/dripforge/types"
import { cn } from "@/lib/utils"
import { Flame, Shield, Sparkles, Wind } from "lucide-react"

function StatBar({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Shield
}) {
  const pct = Math.min(100, Math.max(0, (value / 5) * 100))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className="font-medium tabular-nums">{value}/5</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function FilamentStatsPanel({ color }: { color: FilamentColor | undefined }) {
  if (!color?.strength) return null

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
      {color.displayName && (
        <p className="text-sm font-semibold">{color.displayName}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatBar label="Stabilität" value={color.strength ?? 0} icon={Shield} />
        <StatBar label="Flexibilität" value={color.flexibility ?? 0} icon={Wind} />
        <StatBar
          label="Hitzebeständigkeit"
          value={color.heatResistance ?? 0}
          icon={Flame}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {color.surfaceFinish && (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
            <Sparkles className="h-3 w-3" />
            {color.surfaceFinish}
          </span>
        )}
        {(color.priceSurchargeChf ?? 0) > 0 && (
          <span className={cn("rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-700 dark:text-amber-300")}>
            + CHF {color.priceSurchargeChf!.toFixed(2)} Aufpreis
          </span>
        )}
      </div>
    </div>
  )
}
