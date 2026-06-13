"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { countStockForMaterialType } from "@/lib/admin/list-sort-utils"
import { FILAMENT_SURFACE_FINISHES, type FilamentSurfaceFinish } from "@/lib/admin/filament-types"
import {
  createEmptyMaterialType,
  createMaterialTypeId,
  ratingToPercent,
  sortMaterialTypes,
  type MaterialCategoryStat,
  type MaterialTypeDefinition,
  type MaterialTypeSortMode,
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
  const [materialTypes, setMaterialTypes] = useState<MaterialTypeDefinition[]>([])
  const [stockItems, setStockItems] = useState<{ materialType?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<MaterialTypeSortMode>("manual")

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [typesRes, stockRes] = await Promise.all([
        fetch("/api/admin/material-stats", { cache: "no-store", credentials: "include" }),
        fetch("/api/admin/materials?category=filament", {
          cache: "no-store",
          credentials: "include",
        }),
      ])
      const typesData = await typesRes.json()
      const stockData = await stockRes.json()
      if (!typesRes.ok) throw new Error(typesData.error ?? "Laden fehlgeschlagen")
      setMaterialTypes(typesData.materialTypes ?? [])
      setStockItems(stockData.materials ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Material-Arten konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const sortedTypes = useMemo(
    () => sortMaterialTypes(materialTypes, sortMode),
    [materialTypes, sortMode]
  )

  const updateCategory = (id: string, patch: Partial<MaterialTypeDefinition>) => {
    setMaterialTypes((prev) =>
      prev.map((type) => (type.id === id ? { ...type, ...patch } : type))
    )
    setSuccess(null)
  }

  const addMaterialType = () => {
    const maxOrder = materialTypes.reduce((max, type) => Math.max(max, type.sortOrder), -1)
    const draft = createEmptyMaterialType(maxOrder + 1)
    setMaterialTypes((prev) => [...prev, draft])
    setSuccess(null)
  }

  const removeMaterialType = (id: string) => {
    const type = materialTypes.find((item) => item.id === id)
    if (!type) return
    const count = countStockForMaterialType(stockItems as never[], type)
    if (count > 0) {
      setError(`«${type.name}» hat noch ${count} Lagerartikel — Löschen nicht möglich.`)
      return
    }
    if (!confirm(`Material-Art «${type.name}» wirklich löschen?`)) return
    setMaterialTypes((prev) => prev.filter((item) => item.id !== id))
    setError(null)
    setSuccess(null)
  }

  const saveStats = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const payload = materialTypes.map((type, index) => ({
        ...type,
        id: type.id.trim() || createMaterialTypeId(type.name || `type-${index}`),
        name: type.name.trim() || "Neues Material",
        sortOrder: type.sortOrder ?? index,
      }))

      const res = await fetch("/api/admin/material-stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ materialTypes: payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setMaterialTypes(data.materialTypes ?? payload)
      setSuccess("Material-Arten gespeichert.")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Material-Arten konnten nicht gespeichert werden."
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-16", adminUi.muted)}>
        <Loader2 className="h-5 w-5 animate-spin" />
        Material-Arten werden geladen…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={cn("text-xl font-semibold", adminUi.heading)}>Material-Arten</h2>
          <p className={cn("mt-2 text-sm", adminUi.muted)}>
            Zentrale Eigenschaften pro Filament-Typ — inaktive Arten erscheinen nicht im Shop und
            Lager-Dropdown.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={sortMode}
            onValueChange={(value) => setSortMode(value as MaterialTypeSortMode)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sortierung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Reihenfolge (Homepage)</SelectItem>
              <SelectItem value="name-asc">Name (A–Z)</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" onClick={addMaterialType}>
            <Plus className="mr-2 h-4 w-4" />
            Material-Art hinzufügen
          </Button>
        </div>
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
        {sortedTypes.map((type) => {
          const stockCount = countStockForMaterialType(stockItems as never[], type)
          const canDelete = stockCount === 0
          return (
            <div
              key={type.id}
              className={cn(
                "space-y-4 rounded-xl border p-5",
                adminUi.card,
                !type.isActive && "opacity-75"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={type.name}
                    onChange={(e) => updateCategory(type.id, { name: e.target.value })}
                    className={cn("max-w-[180px] font-semibold", adminUi.input)}
                    placeholder="z. B. PETG-CF"
                  />
                  {!type.isActive && (
                    <Badge variant="outline" className="text-xs">
                      Inaktiv
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={type.isActive}
                      onCheckedChange={(checked) =>
                        updateCategory(type.id, { isActive: checked })
                      }
                    />
                    <span className="text-xs text-muted-foreground">Aktiv</span>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={!canDelete}
                    title={
                      canDelete
                        ? "Material-Art löschen"
                        : `${stockCount} Lagerartikel verknüpft`
                    }
                    onClick={() => removeMaterialType(type.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {sortMode === "manual" && (
                <div className="space-y-1">
                  <Label className="text-xs">Homepage-Reihenfolge</Label>
                  <Input
                    type="number"
                    min={0}
                    value={type.sortOrder}
                    onChange={(e) =>
                      updateCategory(type.id, {
                        sortOrder: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-24"
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ["strength", "Stabilität"],
                    ["flexibility", "Flexibilität"],
                    ["heatResistance", "Hitzebeständigkeit"],
                    ["appearance", "Optik"],
                  ] as const
                ).map(([key, label]) => (
                  <StarRatingInput
                    key={key}
                    label={label}
                    hint={`≈ ${ratingToPercent(type[key])}%`}
                    value={type[key]}
                    onChange={(value) => updateCategory(type.id, { [key]: value })}
                  />
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Verarbeitung (0–100%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={type.easeOfUse}
                    onChange={(e) =>
                      updateCategory(type.id, { easeOfUse: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Standard-Oberfläche</Label>
                  <Select
                    value={type.surfaceFinish}
                    onValueChange={(value) =>
                      updateCategory(type.id, {
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

              <div className="space-y-2">
                <Label>Vorteile (eine Zeile pro Punkt)</Label>
                <Textarea
                  rows={3}
                  value={type.vorteile.join("\n")}
                  onChange={(e) =>
                    updateCategory(type.id, {
                      vorteile: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Hinweise (eine Zeile pro Punkt)</Label>
                <Textarea
                  rows={3}
                  value={type.hinweise.join("\n")}
                  onChange={(e) =>
                    updateCategory(type.id, {
                      hinweise: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Ideal für</Label>
                <Input
                  value={type.idealFuer ?? ""}
                  onChange={(e) =>
                    updateCategory(type.id, { idealFuer: e.target.value || undefined })
                  }
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={() => void saveStats()} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Material-Arten speichern
        </Button>
      </div>
    </div>
  )
}
