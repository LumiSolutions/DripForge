"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  FILAMENT_MATERIAL_TYPES,
  FILAMENT_SURFACE_FINISHES,
  type FilamentMaterialType,
  type FilamentSurfaceFinish,
} from "@/lib/admin/filament-types"
import {
  ratingToPercent,
  type MaterialCategoryStat,
  type MaterialStatsMap,
} from "@/lib/admin/material-stats-types"
import { cn } from "@/lib/utils"

function StarRatingInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={cn(
              "h-9 w-9 rounded-lg border text-sm font-semibold transition-colors",
              value >= star
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            )}
          >
            {star}
          </button>
        ))}
      </div>
    </div>
  )
}

export function AdminMaterialStatsSection() {
  const [materialStats, setMaterialStats] = useState<MaterialStatsMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/material-stats", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setMaterialStats(data.materialStats as MaterialStatsMap)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Material-Stats konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const updateCategory = (
    type: FilamentMaterialType,
    patch: Partial<MaterialCategoryStat>
  ) => {
    setMaterialStats((prev) =>
      prev
        ? {
            ...prev,
            [type]: { ...prev[type], ...patch },
          }
        : prev
    )
    setSuccess(null)
  }

  const saveStats = async () => {
    if (!materialStats) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/material-stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ materialStats }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setMaterialStats(data.materialStats as MaterialStatsMap)
      setSuccess("Material-Kategorien gespeichert. Alle Filamente dieser Typen nutzen die neuen Werte.")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Material-Stats konnten nicht gespeichert werden."
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-16", adminUi.muted)}>
        <Loader2 className="h-5 w-5 animate-spin" />
        Material-Kategorien werden geladen…
      </div>
    )
  }

  if (!materialStats) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
        Material-Stats konnten nicht geladen werden.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={cn("text-xl font-semibold", adminUi.heading)}>Material-Kategorien</h2>
        <p className={cn("mt-2 text-sm", adminUi.muted)}>
          Stabilität, Flexibilität und Hitzebeständigkeit gelten zentral pro Material-Typ (PLA, PETG, …)
          und werden automatisch für alle Farben dieses Typs im Shop und Konfigurator angezeigt.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {FILAMENT_MATERIAL_TYPES.map((type) => {
          const stats = materialStats[type]
          return (
            <div
              key={type}
              className={cn("space-y-4 rounded-xl border p-5", adminUi.card)}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary" className="text-sm">
                  {type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Rating 1–5 · Balken = {ratingToPercent(stats.strength)}% bei Stabilität
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StarRatingInput
                  label="Stabilität"
                  hint={`≈ ${ratingToPercent(stats.strength)}%`}
                  value={stats.strength}
                  onChange={(value) => updateCategory(type, { strength: value })}
                />
                <StarRatingInput
                  label="Flexibilität"
                  hint={`≈ ${ratingToPercent(stats.flexibility)}%`}
                  value={stats.flexibility}
                  onChange={(value) => updateCategory(type, { flexibility: value })}
                />
                <StarRatingInput
                  label="Hitzebeständigkeit"
                  hint={`≈ ${ratingToPercent(stats.heatResistance)}%`}
                  value={stats.heatResistance}
                  onChange={(value) =>
                    updateCategory(type, { heatResistance: value })
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Verarbeitung (Infoseite, 0–100%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={stats.easeOfUse}
                    onChange={(e) =>
                      updateCategory(type, {
                        easeOfUse: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Standard-Oberfläche</Label>
                  <Select
                    value={stats.surfaceFinish}
                    onValueChange={(value) =>
                      updateCategory(type, {
                        surfaceFinish: value as FilamentSurfaceFinish,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILAMENT_SURFACE_FINISHES.map((finish) => (
                        <SelectItem key={finish} value={finish}>
                          {finish}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={() => void saveStats()} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Material-Kategorien speichern
        </Button>
      </div>
    </div>
  )
}
