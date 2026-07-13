"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
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
import { formatTaxCodePercent } from "@/lib/accounting/tax-code-utils"
import type { TaxCode, TaxCodeCategory } from "@/lib/accounting/tax-code-types"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

const CATEGORIES: TaxCodeCategory[] = ["Umsatzsteuer", "Vorsteuer", "Befreit"]

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; taxCode: TaxCode }
  | null

export function AdminAccountingTaxCodesPanel() {
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(null)
  const [code, setCode] = useState("")
  const [systemCode, setSystemCode] = useState("")
  const [name, setName] = useState("")
  const [ratePercent, setRatePercent] = useState("8.1")
  const [category, setCategory] = useState<TaxCodeCategory>("Umsatzsteuer")
  const [isActive, setIsActive] = useState(true)
  const [sortOrder, setSortOrder] = useState("100")

  const loadTaxCodes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/accounting/tax-codes?includeInactive=1&ensure=1", {
        cache: "no-store",
      })
      const data = (await res.json()) as { taxCodes?: TaxCode[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Steuercodes konnten nicht geladen werden.")
      setTaxCodes(data.taxCodes ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Steuercodes konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTaxCodes()
  }, [loadTaxCodes])

  const openCreate = () => {
    setEditor({ mode: "create" })
    setCode("")
    setSystemCode("")
    setName("")
    setRatePercent("8.1")
    setCategory("Umsatzsteuer")
    setIsActive(true)
    setSortOrder(String((taxCodes.length + 1) * 10))
  }

  const openEdit = (taxCode: TaxCode) => {
    setEditor({ mode: "edit", taxCode })
    setCode(taxCode.code)
    setSystemCode(taxCode.systemCode ?? "")
    setName(taxCode.name)
    setRatePercent(String(taxCode.rate * 100))
    setCategory(taxCode.category)
    setIsActive(taxCode.isActive)
    setSortOrder(String(taxCode.sortOrder))
  }

  const closeEditor = () => setEditor(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        systemCode: systemCode.trim() || undefined,
        name: name.trim(),
        rate: Number(ratePercent) / 100,
        category,
        isActive,
        sortOrder: Number(sortOrder) || 0,
      }

      if (editor?.mode === "edit") {
        const res = await fetch(
          `/api/admin/accounting/tax-codes/${encodeURIComponent(editor.taxCode.code)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        )
        const data = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen.")
      } else {
        const res = await fetch("/api/admin/accounting/tax-codes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.trim(), ...payload }),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(data.error ?? "Erstellen fehlgeschlagen.")
      }

      closeEditor()
      await loadTaxCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (taxCode: TaxCode) => {
    if (!window.confirm(`Steuercode ${taxCode.code} wirklich löschen?`)) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/accounting/tax-codes/${encodeURIComponent(taxCode.code)}`,
        { method: "DELETE" }
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Löschen fehlgeschlagen.")
      await loadTaxCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={cn("space-y-4 rounded-xl border p-4 sm:p-6", adminUi.card)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={cn("text-lg font-semibold", adminUi.heading)}>MWST-Sätze verwalten</h2>
          <p className={cn("text-sm", adminUi.muted)}>
            Schweizer Steuercodes für Buchungen und MWST-Abrechnung
          </p>
        </div>
        <Button
          type="button"
          className="bg-blue-600 text-white hover:bg-blue-700"
          onClick={openCreate}
        >
          <Plus className="mr-2 h-4 w-4" />
          Steuercode hinzufügen
        </Button>
      </div>

      {editor && (
        <div className={cn("space-y-4 rounded-xl border p-4", adminUi.cardMuted)}>
          <h3 className={cn("text-base font-semibold", adminUi.heading)}>
            {editor.mode === "create" ? "Neuer Steuercode" : "Steuercode bearbeiten"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Kürzel *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className={adminUi.input}
                disabled={editor.mode === "edit"}
                placeholder="z. B. UN81"
              />
            </div>
            <div className="space-y-2">
              <Label>Systemcode</Label>
              <Input
                value={systemCode}
                onChange={(e) => setSystemCode(e.target.value)}
                className={adminUi.input}
                placeholder="z. B. USt81"
              />
            </div>
            <div className="space-y-2">
              <Label>Bezeichnung *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={adminUi.input}
              />
            </div>
            <div className="space-y-2">
              <Label>Prozentsatz (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value)}
                className={adminUi.input}
              />
            </div>
            <div className="space-y-2">
              <Label>Typ</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaxCodeCategory)}
                className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Sortierung</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={adminUi.input}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Aktiv (in Buchungsmaske sichtbar)
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              Speichern
            </Button>
            <Button
              type="button"
              variant="outline"
              className={adminUi.outlineBtn}
              onClick={closeEditor}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {error && <p className={adminUi.error}>{error}</p>}

      {loading ? (
        <p className={cn("flex items-center text-sm", adminUi.muted)}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Steuercodes werden geladen…
        </p>
      ) : (
        <div className={adminUi.tableWrap}>
          <Table>
            <TableHeader>
              <TableRow className={adminUi.tableHeadRow}>
                <TableHead>Kürzel</TableHead>
                <TableHead>Systemcode</TableHead>
                <TableHead>Bezeichnung</TableHead>
                <TableHead>Satz</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxCodes.map((taxCode) => (
                <TableRow key={taxCode.code} className={adminUi.tableRow}>
                  <TableCell className="font-mono text-xs font-semibold">
                    {taxCode.code}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500">
                    {taxCode.systemCode ?? "—"}
                  </TableCell>
                  <TableCell>{taxCode.name}</TableCell>
                  <TableCell>{formatTaxCodePercent(taxCode.rate)}</TableCell>
                  <TableCell>{taxCode.category}</TableCell>
                  <TableCell>
                    {taxCode.isActive ? (
                      <span className="text-emerald-600">Aktiv</span>
                    ) : (
                      <span className="text-zinc-400">Inaktiv</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={adminUi.footerBtn}
                        onClick={() => openEdit(taxCode)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => void handleDelete(taxCode)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
