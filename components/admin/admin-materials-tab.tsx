"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react"
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
  formatGramStockDisplay,
  formatStockForUnit,
} from "@/lib/admin/material-stock-utils"
import {
  formatMaterialStockLabel,
  getEffectiveMaterialStock,
  isMaterialLowStock,
} from "@/lib/admin/material-types"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type AdminMaterialsTabProps = {
  category: MaterialCategory
}

function StockDisplay({ material }: { material: MaterialItem }) {
  const stock = getEffectiveMaterialStock(material)
  const display =
    material.stockUnit === "gram" ? formatGramStockDisplay(stock.stockTotal) : null

  return (
    <div className="space-y-1 text-sm">
      {display?.label && (
        <p className={cn("font-medium", adminUi.heading)}>{display.label}</p>
      )}
      <p>
        <span className={adminUi.muted}>Verfügbar: </span>
        <span className="font-medium">
          {formatStockForUnit(stock.stockAvailable, material.stockUnit)}
        </span>
      </p>
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
  const [sortMode, setSortMode] = useState<StockSortMode>("stock-asc")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<MaterialItem | null>(null)
  const [addRolls, setAddRolls] = useState("0")
  const [partialGrams, setPartialGrams] = useState("")

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

  const openCreate = () => {
    setDraft({
      id: "",
      docType: "material",
      category,
      name: "",
      materialType: category === "filament" ? activeMaterialTypes[0]?.id ?? "pla" : undefined,
      stockUnit: category === "filament" ? "gram" : "piece",
      stockAvailable: 0,
      stockReserved: 0,
      updatedAt: new Date().toISOString(),
    })
    setAddRolls("0")
    setPartialGrams("0")
    setEditorOpen(true)
  }

  const openEdit = (material: MaterialItem) => {
    setDraft({ ...material })
    const stock = getEffectiveMaterialStock(material)
    const partial =
      material.stockUnit === "gram" ? stock.stockTotal % 1000 : stock.stockAvailable
    setPartialGrams(String(partial))
    setAddRolls("0")
    setEditorOpen(true)
  }

  const saveDraft = async () => {
    if (!draft?.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const isNew = !draft.id
      const res = await fetch(
        isNew ? "/api/admin/materials" : `/api/admin/materials/${encodeURIComponent(draft.id)}`,
        {
          method: isNew ? "POST" : "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")

      let saved = data.material as MaterialItem
      const rolls = Number.parseInt(addRolls, 10)
      const partial = Number.parseInt(partialGrams, 10)
      if (!isNew && (rolls !== 0 || Number.isFinite(partial))) {
        const patchBody: Record<string, unknown> = {}
        if (rolls !== 0) patchBody.addRolls = rolls
        if (Number.isFinite(partial) && draft.stockUnit === "gram") {
          patchBody.setPartialGrams = partial
        }
        if (Object.keys(patchBody).length > 0) {
          const patchRes = await fetch(
            `/api/admin/materials/${encodeURIComponent(saved.id)}`,
            {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(patchBody),
            }
          )
          const patchData = await patchRes.json()
          if (patchRes.ok) saved = patchData.material
        }
      }

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

  const uploadColorImage = async (file: File) => {
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
    setDraft({ ...draft, farbeBildUrl: data.url })
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
            Einzelne Lagerartikel pro Farbe — Materialeigenschaften unter «Material-Arten»
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as StockSortMode)}>
            <SelectTrigger className="w-[210px]">
              <SelectValue placeholder="Sortierung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stock-asc">Bestand (kritisch zuerst)</SelectItem>
              <SelectItem value="material-type">Material-Art</SelectItem>
              <SelectItem value="manufacturer">Hersteller</SelectItem>
              <SelectItem value="color-asc">Farbe (A–Z)</SelectItem>
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

      {sortedMaterials.length === 0 ? (
        <p className={cn("rounded-xl border p-8 text-center text-sm", adminUi.section, adminUi.muted)}>
          Noch keine Lagerartikel in «{categoryLabel}».
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedMaterials.map((material) => (
            <div
              key={material.id}
              className={cn(
                "rounded-xl border p-4",
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
                    {formatMaterialStockLabel(material)}
                  </h3>
                  {material.manufacturer && material.name && (
                    <p className={cn("text-xs", adminUi.muted)}>
                      {material.manufacturer} · {material.name}
                    </p>
                  )}
                </div>
                {material.farbeBildUrl && (
                  <div
                    className={cn(
                      "h-12 w-12 shrink-0 overflow-hidden rounded-lg border",
                      adminUi.thumbnail
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={material.farbeBildUrl}
                      alt={material.farbe ?? "Farbmuster"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                {isMaterialLowStock(material) && (
                  <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Niedrig
                  </Badge>
                )}
              </div>
              <StockDisplay material={material} />
              <div className="mt-4 flex gap-2">
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
                  onClick={() => void deleteMaterial(material.id)}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
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
                <div className="space-y-2 sm:col-span-2">
                  <Label>Farbe</Label>
                  <Input
                    value={draft.farbe ?? ""}
                    onChange={(e) => setDraft({ ...draft, farbe: e.target.value })}
                    placeholder="Black"
                    className={adminUi.input}
                  />
                </div>
              </div>

              <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                <Label>Farbmuster-Bild</Label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Upload className="h-4 w-4" />
                  Bild hochladen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void uploadColorImage(file)
                    }}
                  />
                </label>
                {draft.farbeBildUrl && (
                  <div
                    className={cn(
                      "h-20 w-20 overflow-hidden rounded-lg border",
                      adminUi.thumbnail
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.farbeBildUrl}
                      alt={draft.farbe ?? "Farbmuster"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
              </div>

              {draft.stockUnit === "gram" ? (
                <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                  <p className={cn("text-sm font-semibold", adminUi.accentTitle)}>Bestand (Gramm)</p>
                  <StockDisplay material={draft} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>+ neue Rollen (×1000g)</Label>
                      <Input
                        type="number"
                        value={addRolls}
                        onChange={(e) => setAddRolls(e.target.value)}
                        className={adminUi.input}
                      />
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
                    </div>
                    <div className="space-y-2">
                      <Label>Verfügbar (g)</Label>
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
                      <Label>Reserviert (g)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.stockReserved}
                        readOnly
                        className={cn(adminUi.input, "opacity-70")}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Mindestbestand (g)</Label>
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
