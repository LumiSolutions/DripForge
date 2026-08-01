"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  createDefaultIndividualPricingSettings,
  type IndividualPricingCategory,
  type IndividualPricingSettings,
  type IndividualServicePricing,
} from "@/lib/admin/individual-pricing-types"
import { cn } from "@/lib/utils"

function CategoryEditors({
  title,
  service,
  onChange,
}: {
  title: string
  service: IndividualServicePricing
  onChange: (next: IndividualServicePricing) => void
}) {
  const updateCategory = (
    index: number,
    patch: Partial<IndividualPricingCategory>
  ) => {
    const categories = service.categories.map((cat, i) =>
      i === index ? { ...cat, ...patch } : cat
    )
    onChange({ ...service, categories })
  }

  return (
    <div className="space-y-4">
      <h4 className={cn("text-sm font-semibold", adminUi.heading)}>{title}</h4>
      <div className="grid gap-3">
        {service.categories.map((cat, index) => (
          <div
            key={cat.id}
            className={cn("grid gap-2 rounded-xl border p-3 sm:grid-cols-3", adminUi.section)}
          >
            <div className="space-y-1">
              <Label className={adminUi.label}>Bezeichnung</Label>
              <Input
                value={cat.label}
                onChange={(e) => updateCategory(index, { label: e.target.value })}
                className={adminUi.input}
              />
            </div>
            <div className="space-y-1">
              <Label className={adminUi.label}>Maße / Hinweis</Label>
              <Input
                value={cat.sizeHint}
                onChange={(e) => updateCategory(index, { sizeHint: e.target.value })}
                className={adminUi.input}
              />
            </div>
            <div className="space-y-1">
              <Label className={adminUi.label}>ab CHF</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={cat.fromPriceChf}
                onChange={(e) =>
                  updateCategory(index, {
                    fromPriceChf: Number(e.target.value) || 0,
                  })
                }
                className={adminUi.input}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label className={adminUi.label}>Fussnote / Hinweistext</Label>
        <Textarea
          value={service.footnote}
          onChange={(e) => onChange({ ...service, footnote: e.target.value })}
          rows={3}
          className={adminUi.input}
        />
        <p className={cn("text-xs", adminUi.muted)}>
          Der Wortlaut «unverbindliche Offerte» wird im Shop automatisch auf /kontakt
          verlinkt.
        </p>
      </div>
    </div>
  )
}

export function AdminIndividualPricingSection() {
  const [settings, setSettings] = useState<IndividualPricingSettings>(
    createDefaultIndividualPricingSettings
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/individual-pricing", {
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setSettings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Laden fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/individual-pricing", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setSettings(data)
      setSuccess("Preiskategorien gespeichert.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className={adminUi.card}>
        <CardContent className={cn("flex items-center gap-2 p-6 text-sm", adminUi.muted)}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Preiskategorien werden geladen…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={adminUi.card}>
      <CardContent className="space-y-6 p-6">
        <div>
          <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
            Individuelle Preiskategorien (3D & Laser)
          </h3>
          <p className={cn("mt-1 text-sm", adminUi.muted)}>
            Steuert die drei Kategorien und Hinweistexte in den individuellen
            Konfiguratoren.
          </p>
        </div>

        {error && <p className={adminUi.errorLg}>{error}</p>}
        {success && <p className={adminUi.success}>{success}</p>}

        <CategoryEditors
          title="3D-Druck"
          service={settings.print3d}
          onChange={(print3d) => setSettings((prev) => ({ ...prev, print3d }))}
        />
        <CategoryEditors
          title="Laser"
          service={settings.laser}
          onChange={(laser) => setSettings((prev) => ({ ...prev, laser }))}
        />

        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={adminUi.primaryBtn}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Preiskategorien speichern
        </Button>
      </CardContent>
    </Card>
  )
}
