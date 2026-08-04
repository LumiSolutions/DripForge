"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SHIPPING_OPTIONS, type ShippingMethodId } from "@/lib/dripforge/checkout-config"
import {
  clampDiscountPercent,
  createEmptyCustomerCategory,
  normalizeCustomerCategories,
  type CustomerCategory,
} from "@/lib/dripforge/customer-categories"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

export function AdminCustomerCategoriesCard() {
  const [categories, setCategories] = useState<CustomerCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/settings", { cache: "no-store" })
        const data = await res.json().catch(() => null)
        if (!cancelled) {
          setCategories(normalizeCustomerCategories(data?.customerCategories))
        }
      } catch {
        if (!cancelled) setError("Kategorien konnten nicht geladen werden.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const update = (id: string, patch: Partial<CustomerCategory>) =>
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    )

  const toggleShipping = (id: string, methodId: ShippingMethodId) =>
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        const has = c.allowedShippingMethodIds.includes(methodId)
        return {
          ...c,
          allowedShippingMethodIds: has
            ? c.allowedShippingMethodIds.filter((m) => m !== methodId)
            : [...c.allowedShippingMethodIds, methodId],
        }
      })
    )

  const save = async () => {
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerCategories: normalizeCustomerCategories(categories),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Speichern fehlgeschlagen")
      setCategories(normalizeCustomerCategories(data?.customerCategories))
      setNotice("Kundenkategorien gespeichert.")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={adminUi.card}>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className={cn("text-lg font-bold", adminUi.heading)}>
              Kundenkategorien
            </h3>
            <p className={cn("mt-1 text-sm", adminUi.muted)}>
              Gruppen mit Rabatt und erlaubten Versandarten (z. B. Friends &
              Family, B2B).
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setCategories((prev) => [...prev, createEmptyCustomerCategory()])
            }
          >
            + Kategorie
          </Button>
        </div>

        {loading ? (
          <p className={cn("text-sm", adminUi.muted)}>Lädt …</p>
        ) : categories.length === 0 ? (
          <p className={cn("text-sm", adminUi.muted)}>
            Noch keine Kategorien angelegt.
          </p>
        ) : (
          <div className="space-y-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="space-y-3 rounded-lg border border-border/60 p-4"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
                  <div className="space-y-1">
                    <Label className={adminUi.label}>Name</Label>
                    <Input
                      value={cat.name}
                      onChange={(e) => update(cat.id, { name: e.target.value })}
                      placeholder="z. B. Friends & Family"
                      className={adminUi.input}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className={adminUi.label}>Rabatt %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={cat.discountPercent}
                      onChange={(e) =>
                        update(cat.id, {
                          discountPercent: clampDiscountPercent(e.target.value),
                        })
                      }
                      className={adminUi.input}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() =>
                      setCategories((prev) =>
                        prev.filter((c) => c.id !== cat.id)
                      )
                    }
                  >
                    Entfernen
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className={adminUi.label}>Erlaubte Versandarten</Label>
                  <div className="flex flex-wrap gap-3">
                    {SHIPPING_OPTIONS.map((opt) => {
                      const checked = cat.allowedShippingMethodIds.includes(opt.id)
                      return (
                        <label
                          key={opt.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleShipping(cat.id, opt.id)}
                          />
                          {opt.label}
                        </label>
                      )
                    })}
                  </div>
                  <p className={cn("text-xs", adminUi.muted)}>
                    Keine Auswahl = alle Versandarten erlaubt.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>
        )}

        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Speichern …" : "Kategorien speichern"}
        </Button>
      </CardContent>
    </Card>
  )
}
