"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
  countStockForLaserMaterialType,
  createEmptyLaserMaterialType,
  type LaserMaterialTypeDefinition,
} from "@/lib/admin/laser-material-types"
import {
  createEmptyMaterialType,
  createMaterialTypeId,
  ratingToPercent,
  sortMaterialTypes,
  type MaterialTypeDefinition,
  type MaterialTypeSortMode,
} from "@/lib/admin/material-stats-types"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "active" | "inactive"
type ArtenKind = "filament" | "laser"

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
  const [artenKind, setArtenKind] = useState<ArtenKind>("filament")
  const [materialTypes, setMaterialTypes] = useState<MaterialTypeDefinition[]>([])
  const [laserTypes, setLaserTypes] = useState<LaserMaterialTypeDefinition[]>([])
  const [filamentStock, setFilamentStock] = useState<{ materialType?: string }[]>([])
  const [laserStock, setLaserStock] = useState<
    { category?: string; name?: string; materialType?: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<MaterialTypeSortMode>("manual")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const [jumpToId, setJumpToId] = useState<string>("")

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [typesRes, filamentRes, laserRes] = await Promise.all([
        fetch("/api/admin/material-stats", { cache: "no-store", credentials: "include" }),
        fetch("/api/admin/materials?category=filament", {
          cache: "no-store",
          credentials: "include",
        }),
        fetch("/api/admin/materials?category=lasermaterial", {
          cache: "no-store",
          credentials: "include",
        }),
      ])
      const typesData = await typesRes.json()
      const filamentData = await filamentRes.json()
      const laserData = await laserRes.json()
      if (!typesRes.ok) throw new Error(typesData.error ?? "Laden fehlgeschlagen")
      setMaterialTypes(typesData.materialTypes ?? [])
      setLaserTypes(typesData.laserTypes ?? [])
      setFilamentStock(filamentData.materials ?? [])
      setLaserStock(laserData.materials ?? [])
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

  const sortedFilament = useMemo(
    () => sortMaterialTypes(materialTypes, sortMode),
    [materialTypes, sortMode]
  )

  const sortedLaser = useMemo(() => {
    const copy = [...laserTypes]
    if (sortMode === "name-asc") {
      return copy.sort((a, b) => a.name.localeCompare(b.name, "de"))
    }
    return copy.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")
    )
  }, [laserTypes, sortMode])

  const filteredFilament = useMemo(() => {
    if (statusFilter === "active") return sortedFilament.filter((t) => t.isActive)
    if (statusFilter === "inactive") return sortedFilament.filter((t) => !t.isActive)
    return sortedFilament
  }, [sortedFilament, statusFilter])

  const filteredLaser = useMemo(() => {
    if (statusFilter === "active") return sortedLaser.filter((t) => t.isActive)
    if (statusFilter === "inactive") return sortedLaser.filter((t) => !t.isActive)
    return sortedLaser
  }, [sortedLaser, statusFilter])

  const updateFilament = (id: string, patch: Partial<MaterialTypeDefinition>) => {
    setMaterialTypes((prev) =>
      prev.map((type) => (type.id === id ? { ...type, ...patch } : type))
    )
    setSuccess(null)
  }

  const updateLaser = (id: string, patch: Partial<LaserMaterialTypeDefinition>) => {
    setLaserTypes((prev) =>
      prev.map((type) => (type.id === id ? { ...type, ...patch } : type))
    )
    setSuccess(null)
  }

  const setExpanded = (id: string, open: boolean) => {
    setExpandedIds((prev) => ({ ...prev, [id]: open }))
  }

  const addMaterialType = () => {
    if (artenKind === "laser") {
      const maxOrder = laserTypes.reduce((max, type) => Math.max(max, type.sortOrder), -1)
      const draft = createEmptyLaserMaterialType(maxOrder + 1)
      setLaserTypes((prev) => [...prev, draft])
      setExpandedIds((prev) => ({ ...prev, [draft.id]: true }))
      setStatusFilter("all")
      setSuccess(null)
      requestAnimationFrame(() => {
        document
          .getElementById(`laser-type-${draft.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      })
      return
    }

    const maxOrder = materialTypes.reduce((max, type) => Math.max(max, type.sortOrder), -1)
    const draft = createEmptyMaterialType(maxOrder + 1)
    setMaterialTypes((prev) => [...prev, draft])
    setExpandedIds((prev) => ({ ...prev, [draft.id]: true }))
    setStatusFilter("all")
    setSuccess(null)
    requestAnimationFrame(() => {
      document
        .getElementById(`material-type-${draft.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  const removeFilamentType = (id: string) => {
    const type = materialTypes.find((item) => item.id === id)
    if (!type) return
    const count = countStockForMaterialType(filamentStock as never[], type)
    if (count > 0) {
      setError(`«${type.name}» hat noch ${count} Lagerartikel — Löschen nicht möglich.`)
      return
    }
    if (!confirm(`Material-Art «${type.name}» wirklich löschen?`)) return
    setMaterialTypes((prev) => prev.filter((item) => item.id !== id))
    setExpandedIds((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setError(null)
    setSuccess(null)
  }

  const removeLaserType = (id: string) => {
    const type = laserTypes.find((item) => item.id === id)
    if (!type) return
    const count = countStockForLaserMaterialType(laserStock, type)
    if (count > 0) {
      setError(`«${type.name}» hat noch ${count} Lagerartikel — Löschen nicht möglich.`)
      return
    }
    if (!confirm(`Laser-Materialart «${type.name}» wirklich löschen?`)) return
    setLaserTypes((prev) => prev.filter((item) => item.id !== id))
    setExpandedIds((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setError(null)
    setSuccess(null)
  }

  const jumpToType = (id: string) => {
    setJumpToId(id)
    if (!id) return
    setExpandedIds((prev) => ({ ...prev, [id]: true }))
    const elId = artenKind === "laser" ? `laser-type-${id}` : `material-type-${id}`
    requestAnimationFrame(() => {
      document.getElementById(elId)?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  const saveStats = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      if (artenKind === "laser") {
        const payload = laserTypes.map((type, index) => ({
          id: String(type.id ?? "").trim() || createMaterialTypeId(type.name || `laser-${index}`),
          name: String(type.name ?? "").trim() || "Neues Lasermaterial",
          sortOrder: Number(type.sortOrder) || index,
          isActive: Boolean(type.isActive),
        }))

        const res = await fetch("/api/admin/material-stats", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ laserTypes: payload }),
        })

        const data = (await res.json()) as {
          error?: string
          laserTypes?: LaserMaterialTypeDefinition[]
          materialTypes?: MaterialTypeDefinition[]
        }
        if (!res.ok) {
          throw new Error(
            data.error ?? `Laser-Materialarten konnten nicht gespeichert werden (HTTP ${res.status}).`
          )
        }
        setLaserTypes(data.laserTypes ?? payload)
        if (data.materialTypes) setMaterialTypes(data.materialTypes)
        setSuccess("Laser-Materialarten gespeichert.")
        return
      }

      const payload = materialTypes.map((type, index) => {
        const vorteile =
          typeof type.vorteile === "string"
            ? String(type.vorteile)
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean)
            : Array.isArray(type.vorteile)
              ? type.vorteile.map((s) => String(s).trim()).filter(Boolean)
              : []
        const hinweise =
          typeof type.hinweise === "string"
            ? String(type.hinweise)
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean)
            : Array.isArray(type.hinweise)
              ? type.hinweise.map((s) => String(s).trim()).filter(Boolean)
              : []

        return {
          ...type,
          id: String(type.id ?? "").trim() || createMaterialTypeId(type.name || `type-${index}`),
          name: String(type.name ?? "").trim() || "Neues Material",
          sortOrder: Number(type.sortOrder) || index,
          easeOfUse: Number(type.easeOfUse) || 0,
          strength: Number(type.strength) || 3,
          flexibility: Number(type.flexibility) || 3,
          heatResistance: Number(type.heatResistance) || 3,
          appearance: Number(type.appearance) || 3,
          isActive: Boolean(type.isActive),
          vorteile,
          hinweise,
          idealFuer: type.idealFuer ? String(type.idealFuer) : undefined,
          compositionDescription: type.compositionDescription
            ? String(type.compositionDescription)
            : undefined,
        }
      })

      const res = await fetch("/api/admin/material-stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ materialTypes: payload }),
      })

      let data: {
        error?: string
        materialTypes?: MaterialTypeDefinition[]
        laserTypes?: LaserMaterialTypeDefinition[]
      } = {}
      try {
        data = (await res.json()) as typeof data
      } catch (parseError) {
        console.error("Speicherfehler Details:", parseError)
        throw new Error(`Unerwartete Server-Antwort (HTTP ${res.status}).`)
      }

      if (!res.ok) {
        const message =
          data.error ?? `Material-Arten konnten nicht gespeichert werden (HTTP ${res.status}).`
        console.error("Speicherfehler Details:", { status: res.status, data })
        throw new Error(message)
      }

      setMaterialTypes(data.materialTypes ?? payload)
      if (data.laserTypes) setLaserTypes(data.laserTypes)
      setSuccess("Material-Arten gespeichert.")
    } catch (error) {
      console.error("Speicherfehler Details:", error)
      const message =
        error instanceof Error
          ? error.message
          : "Material-Arten konnten nicht gespeichert werden."
      setError(message)
      window.alert(`Material-Arten: ${message}`)
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

  const jumpList = artenKind === "laser" ? sortedLaser : sortedFilament
  const filteredCount =
    artenKind === "laser" ? filteredLaser.length : filteredFilament.length
  const totalCount = artenKind === "laser" ? laserTypes.length : materialTypes.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={cn("text-xl font-semibold", adminUi.heading)}>Material-Arten</h2>
          <p className={cn("mt-2 text-sm", adminUi.muted)}>
            {artenKind === "laser"
              ? "Laser-Materialarten für Shop und Produkt-Dropdown — inaktive erscheinen nicht."
              : "Zentrale Eigenschaften pro Filament-Typ — inaktive Arten erscheinen nicht im Shop und Lager-Dropdown."}
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
            {artenKind === "laser" ? "Laser-Art hinzufügen" : "Material-Art hinzufügen"}
          </Button>
        </div>
      </div>

      <div className={cn("flex flex-wrap gap-1 rounded-xl border p-1", adminUi.section)}>
        {(
          [
            ["filament", "Filament-Arten"],
            ["laser", "Laser-Materialarten"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setArtenKind(id)
              setJumpToId("")
              setStatusFilter("all")
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              artenKind === id ? adminUi.navActive : adminUi.navInactive
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className={cn("flex flex-wrap gap-1 rounded-xl border p-1", adminUi.section)}>
          {(
            [
              ["all", "Alle"],
              ["active", "Aktiv"],
              ["inactive", "Inaktiv"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                statusFilter === id ? adminUi.navActive : adminUi.navInactive
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Select value={jumpToId || undefined} onValueChange={jumpToType}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Zu Material springen…" />
          </SelectTrigger>
          <SelectContent>
            {jumpList.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name || "Ohne Namen"}
                {!type.isActive ? " (inaktiv)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className={cn("text-xs", adminUi.muted)}>
          {filteredCount} von {totalCount}
        </span>
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

      {artenKind === "laser" ? (
        <div className="space-y-2">
          {filteredLaser.length === 0 ? (
            <p className={cn("py-8 text-center text-sm", adminUi.muted)}>
              Keine Laser-Materialarten für diesen Filter.
            </p>
          ) : (
            filteredLaser.map((type) => {
              const stockCount = countStockForLaserMaterialType(laserStock, type)
              const canDelete = stockCount === 0
              const isOpen = Boolean(expandedIds[type.id])
              return (
                <Collapsible
                  key={type.id}
                  open={isOpen}
                  onOpenChange={(open) => setExpanded(type.id, open)}
                >
                  <div
                    id={`laser-type-${type.id}`}
                    className={cn(
                      "rounded-xl border",
                      adminUi.card,
                      !type.isActive && "opacity-75"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                          aria-label={isOpen ? "Zuklappen" : "Aufklappen"}
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isOpen && "rotate-180"
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleTrigger asChild>
                        <button type="button" className="min-w-0 flex-1 text-left">
                          <span className="font-semibold">{type.name || "Ohne Namen"}</span>
                          <span className={cn("ml-2 text-xs font-mono", adminUi.muted)}>
                            {type.id}
                          </span>
                        </button>
                      </CollapsibleTrigger>
                      {type.isActive ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          Aktiv
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Inaktiv
                        </Badge>
                      )}
                      <span className={cn("text-xs tabular-nums", adminUi.muted)}>
                        {stockCount} Lager
                      </span>
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Switch
                          checked={type.isActive}
                          onCheckedChange={(checked) =>
                            updateLaser(type.id, { isActive: checked })
                          }
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={!canDelete}
                          title={
                            canDelete
                              ? "Laser-Materialart löschen"
                              : `${stockCount} Lagerartikel verknüpft`
                          }
                          onClick={() => removeLaserType(type.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="space-y-4 border-t px-4 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={type.name}
                              onChange={(e) =>
                                updateLaser(type.id, { name: e.target.value })
                              }
                              className={cn("max-w-[220px] font-semibold", adminUi.input)}
                              placeholder="z. B. Holz"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">ID</Label>
                            <Input
                              value={type.id}
                              readOnly
                              className={cn(
                                "max-w-[180px] font-mono text-sm opacity-80",
                                adminUi.input
                              )}
                            />
                          </div>
                          {sortMode === "manual" && (
                            <div className="space-y-1">
                              <Label className="text-xs">Reihenfolge</Label>
                              <Input
                                type="number"
                                min={0}
                                value={type.sortOrder}
                                onChange={(e) =>
                                  updateLaser(type.id, {
                                    sortOrder: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-24"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFilament.length === 0 ? (
            <p className={cn("py-8 text-center text-sm", adminUi.muted)}>
              Keine Material-Arten für diesen Filter.
            </p>
          ) : (
            filteredFilament.map((type) => {
              const stockCount = countStockForMaterialType(filamentStock as never[], type)
              const canDelete = stockCount === 0
              const isOpen = Boolean(expandedIds[type.id])
              return (
                <Collapsible
                  key={type.id}
                  open={isOpen}
                  onOpenChange={(open) => setExpanded(type.id, open)}
                >
                  <div
                    id={`material-type-${type.id}`}
                    className={cn(
                      "rounded-xl border",
                      adminUi.card,
                      !type.isActive && "opacity-75"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                          aria-label={isOpen ? "Zuklappen" : "Aufklappen"}
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isOpen && "rotate-180"
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleTrigger asChild>
                        <button type="button" className="min-w-0 flex-1 text-left">
                          <span className="font-semibold">{type.name || "Ohne Namen"}</span>
                        </button>
                      </CollapsibleTrigger>
                      {type.isActive ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          Aktiv
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Inaktiv
                        </Badge>
                      )}
                      <span className={cn("text-xs tabular-nums", adminUi.muted)}>
                        {stockCount} Lager
                      </span>
                      <span className={cn("text-xs tabular-nums", adminUi.muted)}>
                        Verarb. {type.easeOfUse}%
                      </span>
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Switch
                          checked={type.isActive}
                          onCheckedChange={(checked) =>
                            updateFilament(type.id, { isActive: checked })
                          }
                        />
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
                          onClick={() => removeFilamentType(type.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="space-y-4 border-t px-4 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={type.name}
                              onChange={(e) =>
                                updateFilament(type.id, { name: e.target.value })
                              }
                              className={cn("max-w-[220px] font-semibold", adminUi.input)}
                              placeholder="z. B. PETG-CF"
                            />
                          </div>
                          {sortMode === "manual" && (
                            <div className="space-y-1">
                              <Label className="text-xs">Homepage-Reihenfolge</Label>
                              <Input
                                type="number"
                                min={0}
                                value={type.sortOrder}
                                onChange={(e) =>
                                  updateFilament(type.id, {
                                    sortOrder: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-24"
                              />
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Materialzusammensetzung (Info)</Label>
                          <Textarea
                            rows={2}
                            value={type.compositionDescription ?? ""}
                            onChange={(e) =>
                              updateFilament(type.id, {
                                compositionDescription: e.target.value || undefined,
                              })
                            }
                            placeholder="Kurz erklären, woraus das Material besteht …"
                            className={adminUi.input}
                          />
                          {type.compositionDescription?.trim() ? (
                            <p className={cn("text-xs leading-relaxed", adminUi.muted)}>
                              {type.compositionDescription.trim()}
                            </p>
                          ) : (
                            <p className={cn("text-xs", adminUi.muted)}>
                              Optional — z. B. chemische Basis oder Herkunft des Materials.
                            </p>
                          )}
                        </div>

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
                              onChange={(value) => updateFilament(type.id, { [key]: value })}
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
                                updateFilament(type.id, {
                                  easeOfUse: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Standard-Oberfläche</Label>
                            <Select
                              value={type.surfaceFinish}
                              onValueChange={(value) =>
                                updateFilament(type.id, {
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
                            value={
                              Array.isArray(type.vorteile)
                                ? type.vorteile.join("\n")
                                : String(type.vorteile ?? "")
                            }
                            onChange={(e) =>
                              updateFilament(type.id, {
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
                            value={
                              Array.isArray(type.hinweise)
                                ? type.hinweise.join("\n")
                                : String(type.hinweise ?? "")
                            }
                            onChange={(e) =>
                              updateFilament(type.id, {
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
                              updateFilament(type.id, {
                                idealFuer: e.target.value || undefined,
                              })
                            }
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={() => void saveStats()} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {artenKind === "laser"
            ? "Laser-Materialarten speichern"
            : "Material-Arten speichern"}
        </Button>
      </div>
    </div>
  )
}
