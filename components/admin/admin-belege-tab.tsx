"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Download,
  FilePlus2,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"
import {
  BELEG_TYPE_LABELS,
  computeBelegTotals,
  emptyBelegAddress,
  normalizeBelegPosition,
  statusesForType,
  type Beleg,
  type BelegAddress,
  type BelegPosition,
  type BelegStatus,
  type BelegType,
} from "@/lib/documents/beleg-types"

type EditorState = {
  mode: "create" | "edit"
  type: BelegType
  id?: string
  status: BelegStatus
  kunde: BelegAddress
  positionen: BelegPosition[]
  notes: string
}

function formatChf(value: number): string {
  return `CHF ${value.toFixed(2)}`
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

function emptyEditor(type: BelegType = "offerte"): EditorState {
  return {
    mode: "create",
    type,
    status: statusesForType(type)[0],
    kunde: emptyBelegAddress(),
    positionen: [
      normalizeBelegPosition(
        { name: "", quantity: 1, unitPrice: 0, taxRatePercent: 8.1 },
        0
      ),
    ],
    notes: "",
  }
}

export function AdminBelegeTab() {
  const [activeType, setActiveType] = useState<BelegType>("offerte")
  const [belege, setBelege] = useState<Beleg[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editor, setEditor] = useState<EditorState>(emptyEditor("offerte"))

  const loadBelege = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/belege", {
        credentials: "include",
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setBelege(Array.isArray(data.belege) ? data.belege : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Belege konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBelege()
  }, [loadBelege])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return belege
      .filter((b) => b.type === activeType)
      .filter((b) => (statusFilter === "all" ? true : b.status === statusFilter))
      .filter((b) => {
        if (!q) return true
        const hay = [
          b.id,
          b.status,
          b.kunde.firstName,
          b.kunde.lastName,
          b.kunde.email,
          b.linkedTo ?? "",
          b.sourceOrderId ?? "",
        ]
          .join(" ")
          .toLowerCase()
        return hay.includes(q)
      })
  }, [activeType, belege, query, statusFilter])

  const openCreate = () => {
    setEditor(emptyEditor(activeType === "lieferschein" ? "offerte" : activeType))
    setEditorOpen(true)
  }

  const openEdit = (beleg: Beleg) => {
    setEditor({
      mode: "edit",
      type: beleg.type,
      id: beleg.id,
      status: beleg.status,
      kunde: beleg.kunde,
      positionen: beleg.positionen.length
        ? beleg.positionen
        : emptyEditor().positionen,
      notes: beleg.notes ?? "",
    })
    setEditorOpen(true)
  }

  const updateKunde = <K extends keyof BelegAddress>(key: K, value: BelegAddress[K]) => {
    setEditor((prev) => ({ ...prev, kunde: { ...prev.kunde, [key]: value } }))
  }

  const updatePosition = (index: number, patch: Partial<BelegPosition>) => {
    setEditor((prev) => {
      const positionen = prev.positionen.map((pos, i) =>
        i === index
          ? normalizeBelegPosition({ ...pos, ...patch, id: pos.id }, i)
          : pos
      )
      return { ...prev, positionen }
    })
  }

  const editorTotals = computeBelegTotals(editor.positionen)

  const saveEditor = async () => {
    setSaving(true)
    setError(null)
    try {
      if (editor.mode === "create") {
        const res = await fetch("/api/admin/belege", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: editor.type,
            status: editor.status,
            kunde: editor.kunde,
            positionen: editor.positionen,
            notes: editor.notes,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      } else if (editor.id) {
        const res = await fetch(`/api/admin/belege/${encodeURIComponent(editor.id)}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: editor.status,
            kunde: editor.kunde,
            positionen: editor.positionen,
            notes: editor.notes,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      }
      setEditorOpen(false)
      await loadBelege()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen")
    } finally {
      setSaving(false)
    }
  }

  const downloadPdf = async (beleg: Beleg) => {
    try {
      const res = await fetch(`/api/admin/belege/${encodeURIComponent(beleg.id)}/pdf`, {
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "PDF fehlgeschlagen")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${beleg.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF-Download fehlgeschlagen")
    }
  }

  const convert = async (beleg: Beleg, targetType: BelegType) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/belege/${encodeURIComponent(beleg.id)}/convert`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Umwandlung fehlgeschlagen")
      setActiveType(targetType)
      await loadBelege()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Umwandlung fehlgeschlagen")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (beleg: Beleg) => {
    if (!window.confirm(`Beleg ${beleg.id} wirklich löschen?`)) return
    try {
      const res = await fetch(`/api/admin/belege/${encodeURIComponent(beleg.id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Löschen fehlgeschlagen")
      await loadBelege()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen")
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Belegverwaltung</h1>
          <p className="text-sm text-muted-foreground">
            Offerten, Rechnungen und Lieferscheine inkl. Umwandlung und PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadBelege()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Offerte
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Tabs
        value={activeType}
        onValueChange={(value) => {
          setActiveType(value as BelegType)
          setStatusFilter("all")
        }}
      >
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="offerte">Offerten</TabsTrigger>
          <TabsTrigger value="rechnung">Rechnungen</TabsTrigger>
          <TabsTrigger value="lieferschein">Lieferscheine</TabsTrigger>
        </TabsList>

        {(["offerte", "rechnung", "lieferschein"] as BelegType[]).map((type) => (
          <TabsContent key={type} value={type} className="space-y-4">
            <Card className={adminUi.section}>
              <CardContent className="flex flex-wrap items-end gap-3 p-4">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Suche nach Nummer, Kunde, Status…"
                    className="pl-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={cn("h-10 rounded-md border px-3 text-sm", adminUi.select)}
                  >
                    <option value="all">Alle</option>
                    {statusesForType(type).map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card className={adminUi.section}>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Laden…
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                    Keine {BELEG_TYPE_LABELS[type]} gefunden.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nummer</TableHead>
                        <TableHead>Kunde</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Betrag</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((beleg) => (
                        <TableRow key={beleg.id}>
                          <TableCell className="font-medium">
                            <div>{beleg.id}</div>
                            {beleg.linkedTo ? (
                              <div className="text-xs text-muted-foreground">
                                → {beleg.linkedTo}
                              </div>
                            ) : null}
                            {beleg.sourceOrderId ? (
                              <div className="text-xs text-muted-foreground">
                                Order {beleg.sourceOrderId}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div>
                              {beleg.kunde.firstName} {beleg.kunde.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {beleg.kunde.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">
                              {beleg.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {beleg.type === "lieferschein"
                              ? "—"
                              : formatChf(beleg.total)}
                          </TableCell>
                          <TableCell>{formatDate(beleg.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(beleg)}
                              >
                                <FileText className="mr-1 h-3.5 w-3.5" />
                                Bearbeiten
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void downloadPdf(beleg)}
                              >
                                <Download className="mr-1 h-3.5 w-3.5" />
                                PDF
                              </Button>
                              {beleg.type === "offerte" ? (
                                <Button
                                  size="sm"
                                  onClick={() => void convert(beleg, "rechnung")}
                                  disabled={saving}
                                >
                                  <FilePlus2 className="mr-1 h-3.5 w-3.5" />
                                  → Rechnung
                                </Button>
                              ) : null}
                              {beleg.type === "rechnung" ? (
                                <Button
                                  size="sm"
                                  onClick={() => void convert(beleg, "lieferschein")}
                                  disabled={saving}
                                >
                                  <FilePlus2 className="mr-1 h-3.5 w-3.5" />
                                  → Lieferschein
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void remove(beleg)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editor.mode === "create"
                ? `Neue ${BELEG_TYPE_LABELS[editor.type]}`
                : `${BELEG_TYPE_LABELS[editor.type]} ${editor.id}`}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            {editor.mode === "create" ? (
              <div className="space-y-2">
                <Label>Typ</Label>
                <select
                  value={editor.type}
                  onChange={(e) => {
                    const type = e.target.value as BelegType
                    setEditor((prev) => ({
                      ...prev,
                      type,
                      status: statusesForType(type)[0],
                    }))
                  }}
                  className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                >
                  <option value="offerte">Offerte</option>
                  <option value="rechnung">Rechnung</option>
                </select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={editor.status}
                onChange={(e) =>
                  setEditor((prev) => ({
                    ...prev,
                    status: e.target.value as BelegStatus,
                  }))
                }
                className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
              >
                {statusesForType(editor.type).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Vorname</Label>
              <Input
                value={editor.kunde.firstName}
                onChange={(e) => updateKunde("firstName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Nachname</Label>
              <Input
                value={editor.kunde.lastName}
                onChange={(e) => updateKunde("lastName", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={editor.kunde.email}
                onChange={(e) => updateKunde("email", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Strasse</Label>
              <Input
                value={editor.kunde.street}
                onChange={(e) => updateKunde("street", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>PLZ</Label>
              <Input
                value={editor.kunde.zip}
                onChange={(e) => updateKunde("zip", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ort</Label>
              <Input
                value={editor.kunde.city}
                onChange={(e) => updateKunde("city", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Positionen</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setEditor((prev) => ({
                    ...prev,
                    positionen: [
                      ...prev.positionen,
                      normalizeBelegPosition(
                        {
                          name: "",
                          quantity: 1,
                          unitPrice: 0,
                          taxRatePercent: 8.1,
                        },
                        prev.positionen.length
                      ),
                    ],
                  }))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Position
              </Button>
            </div>
            {editor.positionen.map((pos, index) => (
              <div
                key={pos.id}
                className="grid gap-2 rounded-xl border border-border/60 p-3 sm:grid-cols-6"
              >
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Name / Freitext</Label>
                  <Input
                    value={pos.name}
                    onChange={(e) => updatePosition(index, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Details</Label>
                  <Input
                    value={pos.details ?? ""}
                    onChange={(e) => updatePosition(index, { details: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Menge</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={pos.quantity}
                    onChange={(e) =>
                      updatePosition(index, { quantity: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preis</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.05}
                    value={pos.unitPrice}
                    onChange={(e) =>
                      updatePosition(index, { unitPrice: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">MwSt %</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={pos.taxRatePercent}
                    onChange={(e) =>
                      updatePosition(index, {
                        taxRatePercent: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="flex items-end justify-between gap-2 sm:col-span-5">
                  <p className="text-sm text-muted-foreground">
                    Zeile: {formatChf(pos.lineTotal)}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={editor.positionen.length <= 1}
                    onClick={() =>
                      setEditor((prev) => ({
                        ...prev,
                        positionen: prev.positionen.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    Entfernen
                  </Button>
                </div>
              </div>
            ))}
            <p className="text-sm font-medium">
              Total inkl. MwSt.: {formatChf(editorTotals.total)}{" "}
              <span className="font-normal text-muted-foreground">
                (Netto {formatChf(editorTotals.subtotal)} · MwSt.{" "}
                {formatChf(editorTotals.vatTotal)})
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Notiz</Label>
            <Textarea
              rows={3}
              value={editor.notes}
              onChange={(e) => setEditor((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => void saveEditor()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
