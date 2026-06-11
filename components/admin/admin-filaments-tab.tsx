"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  FILAMENT_MATERIAL_TYPES,
  FILAMENT_SURFACE_FINISHES,
  normalizeAdminFilament,
  type AdminFilament,
  type FilamentMaterialType,
  type FilamentSurfaceFinish,
} from "@/lib/admin/filament-types"
import { cn } from "@/lib/utils"

const EMPTY_FORM: Partial<AdminFilament> = {
  materialType: "PLA",
  manufacturer: "",
  name: "",
  colorName: "",
  colorHex: "#1a1a1a",
  inStock: true,
  strength: 3,
  flexibility: 3,
  heatResistance: 3,
  surfaceFinish: "matt",
  priceSurchargeChf: 0,
}

function StarRatingInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
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

export function AdminFilamentsTab() {
  const [filaments, setFilaments] = useState<AdminFilament[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<AdminFilament>>(EMPTY_FORM)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const sortedFilaments = useMemo(
    () =>
      [...filaments].sort((a, b) =>
        `${a.materialType}-${a.manufacturer}-${a.name}`.localeCompare(
          `${b.materialType}-${b.manufacturer}-${b.name}`
        )
      ),
    [filaments]
  )

  const loadFilaments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/filaments", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setFilaments(Array.isArray(data.filaments) ? data.filaments : [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Filamente konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFilaments()
  }, [loadFilaments])

  const openCreate = () => {
    setForm({ ...EMPTY_FORM })
    setEditingId(null)
    setIsEditing(true)
  }

  const openEdit = (filament: AdminFilament) => {
    setForm({ ...filament })
    setEditingId(filament.id)
    setIsEditing(true)
  }

  const closeEditor = () => {
    setIsEditing(false)
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
  }

  const saveFilament = async () => {
    setSaving(true)
    setError(null)
    try {
      const existing = editingId
        ? filaments.find((item) => item.id === editingId)
        : undefined
      const payload = normalizeAdminFilament(form, existing)
      const res = await fetch(
        editingId ? `/api/admin/filaments/${encodeURIComponent(editingId)}` : "/api/admin/filaments",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      closeEditor()
      await loadFilaments()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Filament konnte nicht gespeichert werden."
      )
    } finally {
      setSaving(false)
    }
  }

  const removeFilament = async (id: string) => {
    if (!confirm("Filament wirklich loeschen?")) return
    setError(null)
    try {
      const res = await fetch(`/api/admin/filaments/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Loeschen fehlgeschlagen")
      await loadFilaments()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Filament konnte nicht geloescht werden."
      )
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-16", adminUi.muted)}>
        <Loader2 className="h-5 w-5 animate-spin" />
        Filamente werden geladen…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold", adminUi.heading)}>Filament-Verwaltung</h1>
          <p className={cn("mt-2 text-sm", adminUi.muted)}>
            Verwalte Materialien, Farben und Eigenschaften fuer den 3D-Druck-Konfigurator.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Filament hinzufuegen
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className={cn("overflow-hidden rounded-xl border", adminUi.card)}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium">Hersteller &amp; Name</th>
                <th className="px-4 py-3 font-medium">Farbe</th>
                <th className="px-4 py-3 font-medium">Lager</th>
                <th className="px-4 py-3 font-medium">Stats</th>
                <th className="px-4 py-3 font-medium">Aufpreis</th>
                <th className="px-4 py-3 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilaments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Noch keine Filamente angelegt.
                  </td>
                </tr>
              ) : (
                sortedFilaments.map((filament) => (
                  <tr key={filament.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{filament.materialType}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{filament.manufacturer}</p>
                      <p className="text-muted-foreground">{filament.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded-full border border-border"
                          style={{ backgroundColor: filament.colorHex }}
                        />
                        {filament.colorName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {filament.inStock ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          Verfuegbar
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Ausverkauft</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      S{filament.strength} · F{filament.flexibility} · H{filament.heatResistance}
                      <br />
                      {filament.surfaceFinish}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      CHF {filament.priceSurchargeChf.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(filament)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void removeFilament(filament.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Filament bearbeiten" : "Filament hinzufuegen"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Material-Typ</Label>
              <Select
                value={form.materialType ?? "PLA"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    materialType: value as FilamentMaterialType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILAMENT_MATERIAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hersteller</Label>
              <Input
                value={form.manufacturer ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, manufacturer: e.target.value }))
                }
                placeholder="z. B. Bambu Lab"
              />
            </div>

            <div className="space-y-2">
              <Label>Produktname</Label>
              <Input
                value={form.name ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="PLA Tough Jet Black"
              />
            </div>

            <div className="space-y-2">
              <Label>Farbname</Label>
              <Input
                value={form.colorName ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, colorName: e.target.value }))
                }
                placeholder="Jet Black"
              />
            </div>

            <div className="space-y-2">
              <Label>Hex-Farbe</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={form.colorHex ?? "#1a1a1a"}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, colorHex: e.target.value }))
                  }
                  className="h-10 w-14 cursor-pointer p-1"
                />
                <Input
                  value={form.colorHex ?? "#1a1a1a"}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, colorHex: e.target.value }))
                  }
                  placeholder="#1a1a1a"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-4 py-3 sm:col-span-2">
              <div>
                <Label>Lagerstatus</Label>
                <p className="text-xs text-muted-foreground">
                  {form.inStock !== false ? "Verfuegbar" : "Ausverkauft"}
                </p>
              </div>
              <Switch
                checked={form.inStock !== false}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, inStock: checked }))
                }
              />
            </div>

            <StarRatingInput
              label="Stabilitaet / Festigkeit"
              value={form.strength ?? 3}
              onChange={(value) => setForm((prev) => ({ ...prev, strength: value }))}
            />
            <StarRatingInput
              label="Flexibilitaet"
              value={form.flexibility ?? 3}
              onChange={(value) => setForm((prev) => ({ ...prev, flexibility: value }))}
            />
            <StarRatingInput
              label="Hitzebestaendigkeit"
              value={form.heatResistance ?? 3}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, heatResistance: value }))
              }
            />

            <div className="space-y-2">
              <Label>Oberflaechen-Finish</Label>
              <Select
                value={form.surfaceFinish ?? "matt"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    surfaceFinish: value as FilamentSurfaceFinish,
                  }))
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

            <div className="space-y-2">
              <Label>Preisaufschlag (CHF)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.priceSurchargeChf ?? 0}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priceSurchargeChf: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeEditor}>
              Abbrechen
            </Button>
            <Button type="button" onClick={() => void saveFilament()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
