"use client"

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  AlertTriangle,
  Copy,
  Loader2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import {
  AdminMaterialsSortableGrid,
  SortableMaterialShell,
} from "@/components/admin/admin-materials-sortable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MaterialCategory, MaterialItem } from "@/lib/admin/material-types"
import {
  findMaterialType,
  getActiveMaterialTypes,
  type MaterialTypeDefinition,
} from "@/lib/admin/material-stats-types"
import { sortStockItems, type StockSortMode } from "@/lib/admin/list-sort-utils"
import {
  availableGramsFromPhysicalAndReserved,
  formatGramStockDisplay,
  formatStockForUnit,
  minStockGramsFromRolls,
  minStockRollsFromGrams,
  physicalGramsFromRollParts,
  rollPartsFromPhysicalGrams,
} from "@/lib/admin/material-stock-utils"
import {
  formatMaterialCardTitle,
  formatMaterialFarbeDisplay,
  getEffectiveMaterialStock,
  GRAMS_PER_FULL_SPOOL,
  isMaterialLowStock,
  resolveMaterialPreviewImage,
} from "@/lib/admin/material-types"
import { materialPurchasePriceUnitLabel } from "@/lib/admin/material-pricing"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type AdminMaterialsTabProps = {
  category: MaterialCategory
}

function StockDisplay({
  material,
  onAdjustAvailable,
  adjusting,
}: {
  material: MaterialItem
  onAdjustAvailable?: (delta: number) => void
  adjusting?: boolean
}) {
  const stock = getEffectiveMaterialStock(material)
  const display =
    material.stockUnit === "gram" ? formatGramStockDisplay(stock.stockTotal) : null
  const showQuickAdjust =
    material.stockUnit === "gram" && onAdjustAvailable != null

  return (
    <div className="space-y-1 text-sm">
      {display?.label && (
        <p className={cn("font-medium", adminUi.heading)}>{display.label}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="min-w-0 flex-1">
          <span className={adminUi.muted}>Verfügbar: </span>
          <span className="font-medium">
            {formatStockForUnit(stock.stockAvailable, material.stockUnit)}
          </span>
        </p>
        {showQuickAdjust && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={adjusting}
              aria-label="1 Rolle abziehen (−1000g)"
              onClick={() => onAdjustAvailable(-GRAMS_PER_FULL_SPOOL)}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={adjusting}
              aria-label="1 Rolle hinzufügen (+1000g)"
              onClick={() => onAdjustAvailable(GRAMS_PER_FULL_SPOOL)}
            >
              {adjusting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}
      </div>
      <p>
        <span className={adminUi.muted}>Reserviert: </span>
        {formatStockForUnit(stock.stockReserved, material.stockUnit)}
      </p>
      <p>
        <span className={adminUi.muted}>Gesamt: </span>
        {formatStockForUnit(stock.stockTotal, material.stockUnit)}
      </p>
      {display?.partialLabel && (
        <Badge variant="outline" className="text-xs">
          {display.partialLabel}
        </Badge>
      )}
    </div>
  )
}

export function AdminMaterialsTab({ category }: AdminMaterialsTabProps) {
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [materialTypes, setMaterialTypes] = useState<MaterialTypeDefinition[]>([])
  const [sortMode, setSortMode] = useState<StockSortMode>("sort-order")
  const [reordering, setReordering] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [artFilter, setArtFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<MaterialItem | null>(null)
  /** Absolute volle Rollen (physischer Bestand, inkl. Reservierung). */
  const [fullRolls, setFullRolls] = useState("0")
  const [partialGrams, setPartialGrams] = useState("0")
  const [minStockRolls, setMinStockRolls] = useState("0")
  const [adjustingStockId, setAdjustingStockId] = useState<string | null>(null)
  /** Debounced Hintergrund-Persist für Drag-&-Drop (kein UI-Block). */
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingOrderRef = useRef<MaterialItem[] | null>(null)
  const reorderGenerationRef = useRef(0)

  const categoryLabel = useMemo(
    () =>
      category === "filament"
        ? "Filament-Lager"
        : category === "lasermaterial"
          ? "Lasermaterial"
          : "Sonstiges",
    [category]
  )

  const activeMaterialTypes = useMemo(
    () => getActiveMaterialTypes(materialTypes),
    [materialTypes]
  )

  const sortedMaterials = useMemo(
    () => sortStockItems(materials, sortMode, materialTypes),
    [materials, sortMode, materialTypes]
  )

  const artOptions = useMemo(() => {
    const set = new Set<string>()
    for (const m of materials) {
      const art = m.materialType?.trim()
      if (art) set.add(art)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"))
  }, [materials])

  const displayedMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return sortedMaterials.filter((m) => {
      if (artFilter !== "all" && (m.materialType?.trim() || "") !== artFilter) {
        return false
      }
      if (!q) return true
      const hay = [
        m.name,
        m.manufacturer,
        m.farbe,
        m.typ,
        m.materialType,
        m.dicke,
        m.formatGroesse,
        m.filamentCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [sortedMaterials, searchQuery, artFilter])

  const materialTypeLabel = useCallback(
    (ref?: string) => findMaterialType(materialTypes, ref)?.name ?? ref ?? "—",
    [materialTypes]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const materialsRes = await fetch(`/api/admin/materials?category=${category}`, {
        cache: "no-store",
        credentials: "include",
      })
      const materialsData = await materialsRes.json()
      if (!materialsRes.ok) throw new Error(materialsData.error ?? "Laden fehlgeschlagen")
      setMaterials(materialsData.materials ?? [])

      if (category === "filament") {
        const typesRes = await fetch("/api/admin/material-stats", {
          cache: "no-store",
          credentials: "include",
        })
        const typesData = await typesRes.json()
        if (typesRes.ok) setMaterialTypes(typesData.materialTypes ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Materialien konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => {
    void load()
  }, [load])

  // Beim Tab-Wechsel Filament ↔ Lasermaterial Filter zurücksetzen
  // (sonst bleiben z. B. Filament-Art-IDs aktiv und blenden alle Laser-Artikel aus)
  useEffect(() => {
    setSearchQuery("")
    setArtFilter("all")
  }, [category])

  const persistOrderInBackground = useCallback(
    async (ordered: MaterialItem[], generation: number) => {
      setError(null)
      try {
        const res = await fetch("/api/admin/materials/reorder", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: ordered.map((m) => m.id) }),
        })
        const data = (await res.json()) as {
          error?: string
          materials?: MaterialItem[]
        }
        if (!res.ok) {
          throw new Error(data.error ?? "Reihenfolge speichern fehlgeschlagen")
        }
        // Neuere lokale Drag-Aktion hat Vorrang — kein Zurücksetzen der UI
        if (generation !== reorderGenerationRef.current) return
        if (Array.isArray(data.materials) && data.materials.length > 0) {
          const orderIndex = new Map(
            ordered.map((m, i) => [m.id, i] as const)
          )
          setMaterials(
            [...data.materials].sort(
              (a, b) =>
                (orderIndex.get(a.id) ?? a.sortOrder ?? 0) -
                (orderIndex.get(b.id) ?? b.sortOrder ?? 0)
            )
          )
        }
      } catch (err) {
        if (generation !== reorderGenerationRef.current) return
        setError(
          err instanceof Error
            ? err.message
            : "Reihenfolge konnte nicht gespeichert werden."
        )
        // Bei Fehler Server-Stand wiederherstellen
        await load()
      } finally {
        if (generation === reorderGenerationRef.current) {
          setReordering(false)
          pendingOrderRef.current = null
        }
      }
    },
    [load]
  )

  useEffect(() => {
    return () => {
      if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current)
      const pending = pendingOrderRef.current
      if (!pending?.length) return
      // Letzte Reihenfolge noch absenden, bevor der Tab unmountet
      void fetch("/api/admin/materials/reorder", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: pending.map((m) => m.id) }),
        keepalive: true,
      }).catch(() => {
        /* ignore unload errors */
      })
    }
  }, [])

  const handleDragReorder = useCallback((orderedIds: string[]) => {
    setMaterials((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]))
      const next = orderedIds
        .map((id) => byId.get(id))
        .filter((m): m is MaterialItem => Boolean(m))
      // Ausgefilterte Artikel (Suche) am Ende belassen
      for (const m of prev) {
        if (!next.some((x) => x.id === m.id)) next.push(m)
      }
      const withOrder = next.map((m, index) => ({
        ...m,
        sortOrder: index,
      }))
      pendingOrderRef.current = withOrder
      return withOrder
    })
    setSortMode("sort-order")
    setReordering(true)

    const generation = ++reorderGenerationRef.current
    if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current)
    reorderTimerRef.current = setTimeout(() => {
      const ordered = pendingOrderRef.current
      if (!ordered) return
      void persistOrderInBackground(ordered, generation)
    }, 400)
  }, [persistOrderInBackground])

  const openCreate = () => {
    const maxOrder = materials.reduce(
      (max, item) => Math.max(max, item.sortOrder ?? 0),
      -1
    )
    setDraft({
      id: "",
      docType: "material",
      category,
      name: "",
      materialType: category === "filament" ? activeMaterialTypes[0]?.id ?? "pla" : undefined,
      stockUnit: category === "filament" ? "gram" : "piece",
      stockAvailable: 0,
      stockReserved: 0,
      sortOrder: maxOrder + 1,
      colorHex: "#1a1a1a",
      updatedAt: new Date().toISOString(),
    })
    setFullRolls("0")
    setPartialGrams("0")
    setMinStockRolls("0")
    setEditorOpen(true)
  }

  const openEdit = (material: MaterialItem) => {
    setDraft({ ...material })
    const stock = getEffectiveMaterialStock(material)
    if (material.stockUnit === "gram") {
      const parts = rollPartsFromPhysicalGrams(stock.stockTotal)
      setFullRolls(String(parts.fullRolls))
      setPartialGrams(String(parts.partialGrams))
      setMinStockRolls(String(minStockRollsFromGrams(material.mindestbestand ?? 0)))
    } else {
      setFullRolls("0")
      setPartialGrams(String(stock.stockAvailable))
      setMinStockRolls(String(Math.max(0, Math.round(material.mindestbestand ?? 0))))
    }
    setEditorOpen(true)
  }

  const openDuplicate = (material: MaterialItem) => {
    setDraft({
      ...material,
      id: "",
      name: `${material.name} (Kopie)`,
      stockAvailable: 0,
      stockReserved: 0,
      updatedAt: new Date().toISOString(),
    })
    setFullRolls("0")
    setPartialGrams("0")
    setMinStockRolls(
      material.stockUnit === "gram"
        ? String(minStockRollsFromGrams(material.mindestbestand ?? 0))
        : String(Math.max(0, Math.round(material.mindestbestand ?? 0)))
    )
    setEditorOpen(true)
  }

  const saveDraft = async () => {
    if (!draft?.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const isNew = !draft.id
      let payload: MaterialItem = { ...draft }

      if (draft.stockUnit === "gram") {
        const rolls = Math.max(0, Math.round(Number(fullRolls) || 0))
        const partial = Math.min(
          GRAMS_PER_FULL_SPOOL - 1,
          Math.max(0, Math.round(Number(partialGrams) || 0))
        )
        const reserved = Math.max(0, Math.round(Number(draft.stockReserved) || 0))
        const physical = physicalGramsFromRollParts(rolls, partial)
        const available = availableGramsFromPhysicalAndReserved(physical, reserved)
        payload = {
          ...draft,
          stockAvailable: available,
          stockReserved: reserved,
          mindestbestand: minStockGramsFromRolls(Number(minStockRolls) || 0),
        }
      }

      const res = await fetch(
        isNew ? "/api/admin/materials" : `/api/admin/materials/${encodeURIComponent(draft.id)}`,
        {
          method: isNew ? "POST" : "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")

      setEditorOpen(false)
      setDraft(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.")
    } finally {
      setSaving(false)
    }
  }

  const deleteMaterial = async (id: string) => {
    if (!confirm("Lagerartikel wirklich löschen?")) return
    await fetch(`/api/admin/materials/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    })
    await load()
  }

  const adjustStockQuick = async (materialId: string, delta: number) => {
    if (delta === 0) return

    let snapshot: MaterialItem[] = []
    setMaterials((items) => {
      snapshot = items
      return items.map((item) =>
        item.id === materialId
          ? {
              ...item,
              stockAvailable: Math.max(0, item.stockAvailable + delta),
            }
          : item
      )
    })
    setAdjustingStockId(materialId)
    setError(null)

    try {
      const res = await fetch(
        `/api/admin/materials/${encodeURIComponent(materialId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adjustAvailable: delta }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Bestand konnte nicht angepasst werden.")

      const saved = data.material as MaterialItem
      setMaterials((items) =>
        items.map((item) => (item.id === saved.id ? saved : item))
      )
      if (draft?.id === saved.id) {
        setDraft(saved)
      }
    } catch (err) {
      setMaterials(snapshot)
      setError(
        err instanceof Error ? err.message : "Bestand konnte nicht angepasst werden."
      )
    } finally {
      setAdjustingStockId(null)
    }
  }

  const uploadMaterialImage = async (
    file: File,
    field: "spuleBildUrl" | "printBildUrl" | "materialImageUrl" | "sampleLaserImageUrl"
  ) => {
    if (!draft) return
    const formData = new FormData()
    formData.append("materialId", draft.id || "temp")
    formData.append("productId", draft.id || "temp")
    formData.append("category", "material-color")
    formData.append("file", file)
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      credentials: "include",
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Upload fehlgeschlagen")
    setDraft({ ...draft, [field]: data.url })
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-24", adminUi.loader)}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {categoryLabel} wird geladen…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={cn("text-xl font-bold", adminUi.heading)}>{categoryLabel}</h2>
          <p className={cn("text-sm", adminUi.muted)}>
            {category === "filament"
              ? "Einzelne Lagerartikel pro Farbe — Materialeigenschaften unter «Material-Arten»"
              : "Platten, Holz, Acryl & Co. — pro Variante (Dicke, Format, Farbe) als Stückbestand"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Suche Name, Typ, Art, Farbe…"
              className={cn("pl-9", adminUi.input)}
            />
          </div>
          {(category === "lasermaterial" || category === "filament") && (
            <Select value={artFilter} onValueChange={setArtFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Materialart" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Arten</SelectItem>
                {category === "filament"
                  ? activeMaterialTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))
                  : artOptions.map((art) => (
                      <SelectItem key={art} value={art}>
                        {art}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          )}
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as StockSortMode)}>
            <SelectTrigger className="w-[210px]">
              <SelectValue placeholder="Sortierung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sort-order">Shop-Reihenfolge (Position)</SelectItem>
              <SelectItem value="stock-asc">Bestand (kritisch zuerst)</SelectItem>
              <SelectItem value="name-asc">Name (A–Z)</SelectItem>
              <SelectItem value="material-type">Material-Art</SelectItem>
              <SelectItem value="manufacturer">Hersteller</SelectItem>
              <SelectItem value="color-asc">Farbe / Typ (A–Z)</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" className={adminUi.outlineBtn} onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
          <Button type="button" className={adminUi.primaryBtn} onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Neuer Lagerartikel
          </Button>
        </div>
      </div>

      {error && <p className={adminUi.errorLg}>{error}</p>}

      {displayedMaterials.length === 0 ? (
        <div className={cn("space-y-4 rounded-xl border p-8 text-center", adminUi.section)}>
          <p className={cn("text-sm", adminUi.muted)}>
            {materials.length === 0
              ? `Noch keine Lagerartikel in «${categoryLabel}».`
              : "Keine Treffer für die aktuelle Suche/Filter."}
          </p>
          {category === "lasermaterial" && materials.length === 0 && (
            <Button
              type="button"
              variant="outline"
              className={adminUi.outlineBtn}
              onClick={() => {
                void (async () => {
                  setLoading(true)
                  try {
                    const res = await fetch(
                      "/api/admin/materials?category=lasermaterial&seed=1",
                      { cache: "no-store", credentials: "include" }
                    )
                    const data = await res.json()
                    if (res.ok) setMaterials(data.materials ?? [])
                    else throw new Error(data.error ?? "Seed fehlgeschlagen")
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Lasermaterialien konnten nicht wiederhergestellt werden."
                    )
                  } finally {
                    setLoading(false)
                  }
                })()
              }}
            >
              Standard-Lasermaterialien wiederherstellen
            </Button>
          )}
          {materials.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchQuery("")
                setArtFilter("all")
              }}
            >
              Filter zurücksetzen
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className={cn("text-xs", adminUi.muted)}>
            Shop-Reihenfolge per Drag &amp; Drop ändern (Griff oben links). Oben =
            erste Stelle im Konfigurator.
            {reordering ? " Speichern im Hintergrund…" : ""}
          </p>
          <AdminMaterialsSortableGrid
            ids={displayedMaterials.map((m) => m.id)}
            disabled={Boolean(searchQuery.trim()) || artFilter !== "all"}
            onReorder={handleDragReorder}
          >
            {displayedMaterials.map((material) => (
              <SortableMaterialShell
                key={material.id}
                id={material.id}
                disabled={Boolean(searchQuery.trim()) || artFilter !== "all"}
              >
                <div
                  className={cn(
                    "rounded-xl border p-4 pt-10",
                    adminUi.section,
                    isMaterialLowStock(material) && "border-amber-500/40"
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {material.materialType && (
                        <Badge variant="secondary" className="mb-1 text-xs">
                          {materialTypeLabel(material.materialType)}
                        </Badge>
                      )}
                      <h3 className={cn("font-semibold", adminUi.heading)}>
                        {formatMaterialCardTitle(material)}
                      </h3>
                      {formatMaterialFarbeDisplay(material) && (
                        <p
                          className={cn(
                            "text-xs text-muted-foreground",
                            adminUi.muted
                          )}
                        >
                          {formatMaterialFarbeDisplay(material)}
                        </p>
                      )}
                    </div>
                    {(resolveMaterialPreviewImage(material) ?? null) && (
                      <div
                        className={cn(
                          "h-12 w-12 shrink-0 overflow-hidden rounded-lg border",
                          adminUi.thumbnail
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveMaterialPreviewImage(material)}
                          alt={material.farbe ?? material.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    {isMaterialLowStock(material) && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/50 text-amber-600"
                      >
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Niedrig
                      </Badge>
                    )}
                  </div>
                  <StockDisplay
                    material={material}
                    adjusting={adjustingStockId === material.id}
                    onAdjustAvailable={
                      material.stockUnit === "gram"
                        ? (delta) => void adjustStockQuick(material.id, delta)
                        : undefined
                    }
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={adminUi.outlineBtn}
                      onClick={() => openEdit(material)}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      Bearbeiten
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={adminUi.outlineBtn}
                      onClick={() => openDuplicate(material)}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Duplizieren
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={adminUi.outlineBtn}
                      onClick={() => void deleteMaterial(material.id)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </SortableMaterialShell>
            ))}
          </AdminMaterialsSortableGrid>
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto sm:max-w-lg", adminUi.card)}>
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Lagerartikel bearbeiten" : "Neuer Lagerartikel"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-4"
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                void saveDraft()
              }}
            >
              {category === "filament" && (
                <div className="space-y-2">
                  <Label>Material-Art</Label>
                  <select
                    value={draft.materialType ?? activeMaterialTypes[0]?.id ?? "pla"}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        materialType: e.target.value,
                      })
                    }
                    className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                  >
                    {activeMaterialTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <p className={cn("text-xs", adminUi.muted)}>
                    Skala, Vorteile und Hinweise werden zentral unter «Material-Arten» gepflegt.
                  </p>
                </div>
              )}

              {category === "filament" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Hersteller</Label>
                    <Input
                      value={draft.manufacturer ?? ""}
                      onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })}
                      placeholder="z. B. Bambu Lab"
                      className={adminUi.input}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Produktlinie / Name</Label>
                    <Input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="PLA Basic"
                      className={adminUi.input}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Farbe</Label>
                    <Input
                      value={draft.farbe ?? ""}
                      onChange={(e) => setDraft({ ...draft, farbe: e.target.value })}
                      placeholder="Black"
                      className={adminUi.input}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Filamentcode / Farbcode</Label>
                    <Input
                      value={draft.filamentCode ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, filamentCode: e.target.value || undefined })
                      }
                      placeholder="z. B. 10100"
                      className={adminUi.input}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hex-Farbe (3D-Vorschau)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={
                          /^#([0-9a-fA-F]{6})$/.test(draft.colorHex ?? "")
                            ? draft.colorHex!
                            : "#1a1a1a"
                        }
                        onChange={(e) =>
                          setDraft({ ...draft, colorHex: e.target.value })
                        }
                        className="h-10 w-14 cursor-pointer p-1"
                        aria-label="Hex-Farbe wählen"
                      />
                      <Input
                        value={draft.colorHex ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            colorHex: e.target.value || undefined,
                          })
                        }
                        placeholder="#1a1a1a"
                        className={adminUi.input}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Shop-Reihenfolge</Label>
                    <p className={cn("rounded-md border px-3 py-2 text-xs", adminUi.muted)}>
                      Per Drag &amp; Drop in der Kartenliste sortieren (oben = erste
                      Stelle). Neue Artikel werden ans Ende gehängt.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Hersteller</Label>
                    <Input
                      value={draft.manufacturer ?? ""}
                      onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })}
                      placeholder="z. B. Plexiglas, WoodForge"
                      className={adminUi.input}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Materialname</Label>
                    <Input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="z. B. Anhänger, Platte, Schild"
                      className={adminUi.input}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Typ</Label>
                    <Input
                      value={draft.typ ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, typ: e.target.value || undefined })
                      }
                      placeholder="z. B. Herz, Rechteck, Rund"
                      className={adminUi.input}
                      list="laser-typ-suggestions"
                    />
                    <datalist id="laser-typ-suggestions">
                      <option value="Herz" />
                      <option value="Rechteck" />
                      <option value="Rund" />
                      <option value="Schild" />
                      <option value="Anhänger" />
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label>Art (Werkstoff)</Label>
                    <Input
                      value={draft.materialType ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          materialType: e.target.value || undefined,
                        })
                      }
                      placeholder="z. B. Edelstahl, Schiefer & Stein, Holz"
                      className={adminUi.input}
                      list="laser-art-suggestions"
                    />
                    <datalist id="laser-art-suggestions">
                      <option value="Edelstahl" />
                      <option value="Schiefer & Stein" />
                      <option value="Holz" />
                      <option value="Acryl" />
                      <option value="Leder" />
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label>Dicke / Stärke</Label>
                    <Input
                      value={draft.dicke ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, dicke: e.target.value || undefined })
                      }
                      placeholder="z. B. 3mm, 5mm"
                      className={adminUi.input}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Format / Grösse</Label>
                    <Input
                      value={draft.formatGroesse ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, formatGroesse: e.target.value || undefined })
                      }
                      placeholder="z. B. A4, 30x30 cm"
                      className={adminUi.input}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Farbe / Optik (optional)</Label>
                    <Input
                      value={draft.farbe ?? ""}
                      onChange={(e) => setDraft({ ...draft, farbe: e.target.value })}
                      placeholder="z. B. Rauchglas, Natur, Gold"
                      className={adminUi.input}
                    />
                  </div>
                </div>
              )}

              <div className={cn("space-y-2 rounded-xl border p-4", adminUi.section)}>
                <Label>Einkaufspreis pro Einheit (CHF)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.purchasePrice ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      purchasePrice:
                        e.target.value === ""
                          ? undefined
                          : Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  placeholder="0.00"
                  className={adminUi.input}
                />
                <p className={cn("text-xs", adminUi.muted)}>
                  {materialPurchasePriceUnitLabel(draft)} — Basis für die Produktkalkulation.
                </p>
              </div>

              {category === "filament" && (
                <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                  <Label>Beispiel Print-Bild (Farbmuster)</Label>
                  <p className={cn("text-xs", adminUi.muted)}>
                    Ein Vorschaubild pro Filament-Farbe — erscheint im Shop.
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Upload className="h-4 w-4" />
                    Bild hochladen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void uploadMaterialImage(file, "printBildUrl")
                      }}
                    />
                  </label>
                  {draft.printBildUrl || draft.spuleBildUrl ? (
                    <div className="relative h-20 w-20">
                      <div
                        className={cn(
                          "h-full w-full overflow-hidden rounded-lg border",
                          adminUi.thumbnail
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={draft.printBildUrl || draft.spuleBildUrl}
                          alt={draft.farbe ?? "Print-Beispiel"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute -right-2 -top-2 h-6 w-6 rounded-full shadow"
                        title="Farbmuster-Bild entfernen"
                        aria-label="Farbmuster-Bild entfernen"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            ...(draft.printBildUrl
                              ? { printBildUrl: "" }
                              : { spuleBildUrl: "" }),
                          })
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className={cn("text-xs", adminUi.muted)}>Noch kein Print-Beispiel</p>
                  )}
                </div>
              )}

              {category === "lasermaterial" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                    <Label>Material-Bild (Rohzustand)</Label>
                    <p className={cn("text-xs", adminUi.muted)}>
                      z. B. Foto der Holzplatte oder Acrylstruktur — erscheint als Option im Shop.
                    </p>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Upload className="h-4 w-4" />
                      Bild hochladen
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void uploadMaterialImage(file, "materialImageUrl")
                        }}
                      />
                    </label>
                    {draft.materialImageUrl ? (
                      <div
                        className={cn(
                          "h-20 w-20 overflow-hidden rounded-lg border",
                          adminUi.thumbnail
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={draft.materialImageUrl}
                          alt={draft.name || "Material-Bild"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <p className={cn("text-xs", adminUi.muted)}>Noch kein Material-Bild</p>
                    )}
                  </div>

                  <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                    <Label>Beispiel Gravur/Schnitt-Bild</Label>
                    <p className={cn("text-xs", adminUi.muted)}>
                      Gelasertes Musterbeispiel — zeigt das fertig bearbeitete Material.
                    </p>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Upload className="h-4 w-4" />
                      Bild hochladen
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void uploadMaterialImage(file, "sampleLaserImageUrl")
                        }}
                      />
                    </label>
                    {draft.sampleLaserImageUrl ? (
                      <div
                        className={cn(
                          "h-20 w-20 overflow-hidden rounded-lg border",
                          adminUi.thumbnail
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={draft.sampleLaserImageUrl}
                          alt={draft.name || "Gravur-Beispiel"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <p className={cn("text-xs", adminUi.muted)}>
                        Noch kein Gravur/Schnitt-Beispiel
                      </p>
                    )}
                  </div>
                </div>
              )}

              {draft.stockUnit === "gram" ? (
                <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                  <p className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                    Bestand (Rollen)
                  </p>
                  <p className={cn("text-xs", adminUi.muted)}>
                    1 Rolle = {GRAMS_PER_FULL_SPOOL}g. Verfügbar wird automatisch
                    berechnet: (volle Rollen × {GRAMS_PER_FULL_SPOOL}g) + angefangen −
                    reserviert.
                  </p>
                  {(() => {
                    const rolls = Math.max(0, Math.round(Number(fullRolls) || 0))
                    const partial = Math.min(
                      GRAMS_PER_FULL_SPOOL - 1,
                      Math.max(0, Math.round(Number(partialGrams) || 0))
                    )
                    const reserved = Math.max(
                      0,
                      Math.round(Number(draft.stockReserved) || 0)
                    )
                    const physical = physicalGramsFromRollParts(rolls, partial)
                    const available = availableGramsFromPhysicalAndReserved(
                      physical,
                      reserved
                    )
                    const preview: MaterialItem = {
                      ...draft,
                      stockAvailable: available,
                      stockReserved: reserved,
                      mindestbestand: minStockGramsFromRolls(
                        Number(minStockRolls) || 0
                      ),
                    }
                    return <StockDisplay material={preview} />
                  })()}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Volle Rollen (Stück)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={fullRolls}
                        onChange={(e) => setFullRolls(e.target.value)}
                        className={adminUi.input}
                      />
                      <p className={cn("text-xs", adminUi.muted)}>
                        Primärer Bestand — physische volle Spulen.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Angefangene Rolle (g)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={999}
                        value={partialGrams}
                        onChange={(e) => setPartialGrams(e.target.value)}
                        className={adminUi.input}
                      />
                      <p className={cn("text-xs", adminUi.muted)}>
                        Aus dem Bestand vorausgefüllt; manuell korrigierbar.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Verfügbar (g) — berechnet</Label>
                      <Input
                        type="number"
                        readOnly
                        value={availableGramsFromPhysicalAndReserved(
                          physicalGramsFromRollParts(
                            Math.max(0, Math.round(Number(fullRolls) || 0)),
                            Math.max(0, Math.round(Number(partialGrams) || 0))
                          ),
                          Math.max(0, Math.round(Number(draft.stockReserved) || 0))
                        )}
                        className={cn(adminUi.input, "opacity-70")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reserviert (g)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.stockReserved}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            stockReserved: Math.max(
                              0,
                              Math.round(Number(e.target.value) || 0)
                            ),
                          })
                        }
                        className={adminUi.input}
                      />
                      <p className={cn("text-xs", adminUi.muted)}>
                        Automatisch aus offenen Bestellungen; manuell
                        überschreibbar.
                      </p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Mindestbestand (Rollen)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={minStockRolls}
                        onChange={(e) => setMinStockRolls(e.target.value)}
                        className={adminUi.input}
                      />
                      <p className={cn("text-xs", adminUi.muted)}>
                        z. B. 5 = Warnung unter 5 vollen Rollen (
                        {minStockGramsFromRolls(Number(minStockRolls) || 0)}g).
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                  <p className={cn("text-sm font-semibold", adminUi.accentTitle)}>Bestand (Stück)</p>
                  <StockDisplay material={draft} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Verfügbar</Label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.stockAvailable}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            stockAvailable: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className={adminUi.input}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mindestbestand</Label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.mindestbestand ?? 0}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            mindestbestand: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className={adminUi.input}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Bemerkungen (nur dieser Lagerartikel)</Label>
                <Textarea
                  value={draft.bemerkungen ?? ""}
                  onChange={(e) => setDraft({ ...draft, bemerkungen: e.target.value })}
                  rows={3}
                  placeholder="z. B. Charge, Lagerplatz, Qualitätsnotiz…"
                  className={adminUi.input}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" className={adminUi.primaryBtn} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Speichern
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
