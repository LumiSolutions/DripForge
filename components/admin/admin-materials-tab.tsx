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
  X,
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
import { createEmptyVariant } from "@/lib/admin/material-types"
import type { MaterialCategory } from "@/lib/admin/material-types"
import {
  formatGramStockDisplay,
  formatStockForUnit,
} from "@/lib/admin/material-stock-utils"
import {
  getEffectiveMaterialStock,
  isMaterialLowStock,
  type MaterialItem,
  type MaterialScaleRating,
  type MaterialVariant,
} from "@/lib/admin/material-types"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type AdminMaterialsTabProps = {
  category: MaterialCategory
}

function emptyScale(): MaterialScaleRating {
  return { flexibility: 3, strength: 3, heatResistance: 3, appearance: 3 }
}

function StockDisplay({ material }: { material: MaterialItem }) {
  const stock = getEffectiveMaterialStock(material)
  const display =
    material.stockUnit === "gram"
      ? formatGramStockDisplay(stock.stockTotal)
      : null

  return (
    <div className="space-y-1 text-sm">
      <p>
        <span className={adminUi.muted}>Verfügbar: </span>
        <span className="font-medium">{formatStockForUnit(stock.stockAvailable, material.stockUnit)}</span>
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<MaterialItem | null>(null)
  const [addRolls, setAddRolls] = useState("0")
  const [partialGrams, setPartialGrams] = useState("")

  const categoryLabel = useMemo(
    () => (category === "filament" ? "Filament" : category === "lasermaterial" ? "Lasermaterial" : "Sonstiges"),
    [category]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/materials?category=${category}`, {
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setMaterials(data.materials ?? [])
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
      stockUnit: category === "filament" ? "gram" : "piece",
      stockAvailable: 0,
      stockReserved: 0,
      variants: [],
      vorteile: [],
      hinweise: [],
      skala: category === "filament" ? emptyScale() : undefined,
      updatedAt: new Date().toISOString(),
    })
    setAddRolls("0")
    setPartialGrams("")
    setEditorOpen(true)
  }

  const openEdit = (material: MaterialItem) => {
    setDraft({ ...material, skala: material.skala ?? emptyScale() })
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
    if (!confirm("Material wirklich löschen?")) return
    await fetch(`/api/admin/materials/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    })
    await load()
  }

  const uploadColorImage = async (variantId: string, file: File) => {
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
    setDraft({
      ...draft,
      variants: draft.variants.map((v) =>
        v.id === variantId ? { ...v, farbeBildUrl: data.url } : v
      ),
    })
  }

  const updateVariant = (variantId: string, patch: Partial<MaterialVariant>) => {
    if (!draft) return
    setDraft({
      ...draft,
      variants: draft.variants.map((v) => (v.id === variantId ? { ...v, ...patch } : v)),
    })
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
            Rohmaterial mit Varianten, Gramm-Bestand und Skala-Werten
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className={adminUi.outlineBtn} onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
          <Button type="button" className={adminUi.primaryBtn} onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Neues Material
          </Button>
        </div>
      </div>

      {error && <p className={adminUi.errorLg}>{error}</p>}

      {materials.length === 0 ? (
        <p className={cn("rounded-xl border p-8 text-center text-sm", adminUi.section, adminUi.muted)}>
          Noch keine Materialien in «{categoryLabel}».
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {materials.map((material) => (
            <div
              key={material.id}
              className={cn(
                "rounded-xl border p-4",
                adminUi.section,
                isMaterialLowStock(material) && "border-amber-500/40"
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className={cn("font-semibold", adminUi.heading)}>{material.name}</h3>
                  {material.manufacturer && (
                    <p className={cn("text-xs", adminUi.muted)}>{material.manufacturer}</p>
                  )}
                </div>
                {isMaterialLowStock(material) && (
                  <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Niedrig
                  </Badge>
                )}
              </div>
              <StockDisplay material={material} />
              {material.variants.length > 0 && (
                <p className={cn("mt-2 text-xs", adminUi.muted)}>
                  {material.variants.length} Variante{material.variants.length === 1 ? "" : "n"}
                </p>
              )}
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
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto sm:max-w-2xl", adminUi.card)}>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Material bearbeiten" : "Neues Material"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-4"
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                void saveDraft()
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className={adminUi.input}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hersteller</Label>
                  <Input
                    value={draft.manufacturer ?? ""}
                    onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })}
                    className={adminUi.input}
                  />
                </div>
              </div>

              {draft.stockUnit === "gram" && (
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
                      <Label>Verfügbar (g) — direkt</Label>
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
              )}

              {category === "filament" && draft.skala && (
                <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                  <p className={cn("text-sm font-semibold", adminUi.accentTitle)}>Skala (1–5)</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["flexibility", "Flexibilität"],
                        ["strength", "Belastbarkeit"],
                        ["heatResistance", "Hitzebeständigkeit"],
                        ["appearance", "Optik"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <Label>{label}</Label>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={draft.skala![key]}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              skala: {
                                ...draft.skala!,
                                [key]: Math.min(5, Math.max(1, Number(e.target.value) || 3)),
                              },
                            })
                          }
                          className={adminUi.input}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Varianten (Farben)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={adminUi.outlineBtn}
                    onClick={() =>
                      setDraft({ ...draft, variants: [...draft.variants, createEmptyVariant()] })
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Variante
                  </Button>
                </div>
                {draft.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className={cn("grid gap-2 rounded-lg border p-3 sm:grid-cols-2", adminUi.section)}
                  >
                    <Input
                      placeholder="Farbe"
                      value={variant.farbe ?? ""}
                      onChange={(e) => updateVariant(variant.id, { farbe: e.target.value })}
                      className={adminUi.input}
                    />
                    <Input
                      type="number"
                      placeholder="Verfügbar (g)"
                      value={variant.stockAvailable}
                      onChange={(e) =>
                        updateVariant(variant.id, {
                          stockAvailable: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className={adminUi.input}
                    />
                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                      <Upload className="h-3 w-3" />
                      Farbbild
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void uploadColorImage(variant.id, file)
                        }}
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          variants: draft.variants.filter((v) => v.id !== variant.id),
                        })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Bemerkungen</Label>
                <Textarea
                  value={draft.bemerkungen ?? ""}
                  onChange={(e) => setDraft({ ...draft, bemerkungen: e.target.value })}
                  className={adminUi.input}
                />
              </div>
              <div className="space-y-2">
                <Label>Ideal für</Label>
                <Input
                  value={draft.idealFuer ?? ""}
                  onChange={(e) => setDraft({ ...draft, idealFuer: e.target.value })}
                  className={adminUi.input}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" className={adminUi.primaryBtn} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
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
