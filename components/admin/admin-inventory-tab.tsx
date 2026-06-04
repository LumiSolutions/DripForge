"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { AlertTriangle, Loader2, Minus, Plus, RefreshCw, Trash2, Warehouse } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  isLowStock,
  type InventoryUnit,
  type StoredInventoryMaterial,
} from "@/lib/admin/inventory-types"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

function formatStock(value: number, einheit: InventoryUnit): string {
  if (einheit === "kg") {
    return `${value.toLocaleString("de-CH", { maximumFractionDigits: 2 })} kg`
  }
  return `${value.toLocaleString("de-CH", { maximumFractionDigits: 0 })} Stk.`
}

function stockDelta(einheit: InventoryUnit, direction: 1 | -1): number {
  return einheit === "kg" ? direction * 0.5 : direction * 1
}

export function AdminInventoryTab() {
  const [materials, setMaterials] = useState<StoredInventoryMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [newName, setNewName] = useState("")
  const [newBestand, setNewBestand] = useState("0")
  const [newMindest, setNewMindest] = useState("0")
  const [newEinheit, setNewEinheit] = useState<InventoryUnit>("Stück")
  const [newLieferant, setNewLieferant] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/inventory", { cache: "no-store" })
      const data = (await res.json()) as {
        materials?: StoredInventoryMaterial[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setMaterials(data.materials ?? [])
    } catch (err) {
      console.warn("Admin: Lagerverwaltung konnte nicht geladen werden.", err)
      setError(
        err instanceof Error ? err.message : "Lager konnte nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const patchMaterial = async (
    id: string,
    body: Record<string, unknown>
  ): Promise<StoredInventoryMaterial | null> => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/inventory/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as {
        material?: StoredInventoryMaterial
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Update fehlgeschlagen")
      if (data.material) {
        setMaterials((prev) =>
          prev.map((m) => (m.id === id ? data.material! : m))
        )
      }
      return data.material ?? null
    } catch (err) {
      console.warn("Admin: Lager-Update fehlgeschlagen.", err)
      setError(err instanceof Error ? err.message : "Update fehlgeschlagen")
      return null
    } finally {
      setUpdatingId(null)
    }
  }

  const handleAdjust = (material: StoredInventoryMaterial, direction: 1 | -1) => {
    void patchMaterial(material.id, {
      adjustBy: stockDelta(material.einheit, direction),
    })
  }

  const handleFieldBlur = (
    material: StoredInventoryMaterial,
    field: "mindestbestand" | "lieferant",
    raw: string
  ) => {
    if (field === "mindestbestand") {
      const value = Number(raw)
      if (Number.isNaN(value) || value === material.mindestbestand) return
      void patchMaterial(material.id, { mindestbestand: value })
      return
    }
    if (raw === material.lieferant) return
    void patchMaterial(material.id, { lieferant: raw })
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          bestand: Number(newBestand) || 0,
          mindestbestand: Number(newMindest) || 0,
          einheit: newEinheit,
          lieferant: newLieferant,
        }),
      })
      const data = (await res.json()) as {
        material?: StoredInventoryMaterial
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Anlegen fehlgeschlagen")
      if (data.material) {
        setMaterials((prev) =>
          [...prev, data.material!].sort((a, b) => a.name.localeCompare(b.name))
        )
      }
      setNewName("")
      setNewBestand("0")
      setNewMindest("0")
      setNewEinheit("Stück")
      setNewLieferant("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Material konnte nicht angelegt werden.")
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Material wirklich aus dem Lager entfernen?")) return
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/inventory/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Löschen fehlgeschlagen")
      }
      setMaterials((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen")
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading && materials.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-24", adminUi.loader)}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Lagerverwaltung wird geladen…
      </div>
    )
  }

  const lowStockCount = materials.filter(isLowStock).length

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={cn("flex items-center gap-2 text-xl font-bold", adminUi.heading)}>
            <Warehouse className="h-5 w-5 text-orange-500" />
            Lagerverwaltung
          </h2>
          <p className={cn("text-sm", adminUi.muted)}>
            {materials.length} Rohmaterialien
            {lowStockCount > 0 && (
              <span className="ml-2 text-red-600 dark:text-red-400">
                · {lowStockCount} unter Meldebestand
              </span>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
          className={adminUi.outlineBtn}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Aktualisieren
        </Button>
      </div>

      {error && <p className={adminUi.errorLg}>{error}</p>}

      <form
        onSubmit={handleAdd}
        className={cn("grid gap-4 rounded-xl border p-5 sm:grid-cols-2 lg:grid-cols-6", adminUi.card)}
      >
        <div className="space-y-2 sm:col-span-2">
          <Label className={adminUi.label}>Neues Material</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="z. B. Filament Weiss"
            className={adminUi.input}
            required
          />
        </div>
        <div className="space-y-2">
          <Label className={adminUi.label}>Startbestand</Label>
          <Input
            type="number"
            min={0}
            step={newEinheit === "kg" ? 0.1 : 1}
            value={newBestand}
            onChange={(e) => setNewBestand(e.target.value)}
            className={adminUi.input}
          />
        </div>
        <div className="space-y-2">
          <Label className={adminUi.label}>Mindestbestand</Label>
          <Input
            type="number"
            min={0}
            step={newEinheit === "kg" ? 0.1 : 1}
            value={newMindest}
            onChange={(e) => setNewMindest(e.target.value)}
            className={adminUi.input}
          />
        </div>
        <div className="space-y-2">
          <Label className={adminUi.label}>Einheit</Label>
          <select
            value={newEinheit}
            onChange={(e) => setNewEinheit(e.target.value as InventoryUnit)}
            className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
          >
            <option value="Stück">Stück</option>
            <option value="kg">kg</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label className={adminUi.label}>Lieferant</Label>
          <Input
            value={newLieferant}
            onChange={(e) => setNewLieferant(e.target.value)}
            placeholder="Optional"
            className={adminUi.input}
          />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-6">
          <Button
            type="submit"
            disabled={adding || !newName.trim()}
            className={adminUi.primaryBtn}
          >
            {adding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Material hinzufügen
          </Button>
        </div>
      </form>

      <div className={adminUi.tableWrap}>
        <Table>
          <TableHeader>
            <TableRow className={adminUi.tableHeadRow}>
              <TableHead className={adminUi.tableHead}>Name</TableHead>
              <TableHead className={adminUi.tableHead}>Aktueller Bestand</TableHead>
              <TableHead className={adminUi.tableHead}>Mindestbestand</TableHead>
              <TableHead className={adminUi.tableHead}>Lieferant</TableHead>
              <TableHead className={cn("w-12", adminUi.tableHead)} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className={cn("py-12 text-center text-sm", adminUi.muted)}
                >
                  Noch keine Materialien erfasst.
                </TableCell>
              </TableRow>
            ) : (
              materials.map((material) => {
                const low = isLowStock(material)
                const busy = updatingId === material.id
                return (
                  <TableRow
                    key={material.id}
                    className={cn(
                      adminUi.tableRow,
                      low &&
                        "bg-red-500/10 hover:bg-red-500/15 dark:bg-red-950/40 dark:hover:bg-red-950/50"
                    )}
                  >
                    <TableCell className={adminUi.tableCell}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("font-medium", adminUi.heading)}>
                          {material.name}
                        </span>
                        {low && (
                          <Badge
                            variant="outline"
                            className="border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300"
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Nachbestellen!
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          disabled={busy || material.bestand <= 0}
                          className={cn("h-8 w-8 shrink-0", adminUi.outlineBtn)}
                          onClick={() => handleAdjust(material, -1)}
                          aria-label="Bestand reduzieren"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span
                          className={cn(
                            "min-w-[5.5rem] text-center font-semibold tabular-nums",
                            low ? "text-red-600 dark:text-red-400" : adminUi.accentTitle
                          )}
                        >
                          {formatStock(material.bestand, material.einheit)}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          disabled={busy}
                          className={cn("h-8 w-8 shrink-0", adminUi.outlineBtn)}
                          onClick={() => handleAdjust(material, 1)}
                          aria-label="Bestand erhöhen"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        key={`min-${material.id}-${material.mindestbestand}`}
                        type="number"
                        min={0}
                        step={material.einheit === "kg" ? 0.1 : 1}
                        defaultValue={material.mindestbestand}
                        disabled={busy}
                        className={cn("max-w-[120px]", adminUi.input)}
                        onBlur={(e) =>
                          handleFieldBlur(material, "mindestbestand", e.target.value)
                        }
                      />
                      <span className={cn("ml-1 text-xs", adminUi.muted)}>
                        {material.einheit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input
                        key={`sup-${material.id}-${material.lieferant}`}
                        defaultValue={material.lieferant}
                        disabled={busy}
                        placeholder="Lieferant"
                        className={adminUi.input}
                        onBlur={(e) =>
                          handleFieldBlur(material, "lieferant", e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={busy}
                        className="text-red-600 hover:text-red-500 dark:text-red-400"
                        onClick={() => void handleDelete(material.id)}
                        aria-label="Material löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
