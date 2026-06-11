"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  buildDefaultAiCategory,
  type AiCategoryConfig,
  type AiCutoutSpec,
  type AiSettingsDocument,
} from "@/lib/ai/ai-settings-types"
import { cn } from "@/lib/utils"

export function AdminAiSettingsTab() {
  const [settings, setSettings] = useState<AiSettingsDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/ai-settings", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setSettings(data.settings as AiSettingsDocument)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "KI-Einstellungen konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const lampCategory =
    settings?.categories.find((c) => c.id === "lampen") ??
    buildDefaultAiCategory("lampen")

  const updateLampCategory = (patch: Partial<AiCategoryConfig>) => {
    setSettings((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        categories: prev.categories.map((c) =>
          c.id === "lampen" ? { ...c, ...patch } : c
        ),
      }
    })
  }

  const updateCutout = (index: number, patch: Partial<AiCutoutSpec>) => {
    const next = [...lampCategory.cutouts]
    next[index] = { ...next[index], ...patch }
    updateLampCategory({ cutouts: next })
  }

  const addCutout = () => {
    updateLampCategory({
      cutouts: [
        ...lampCategory.cutouts,
        {
          id: `cutout-${Date.now()}`,
          label: "Neue Aussparung",
          diameterMm: null,
          widthMm: null,
          heightMm: null,
          depthMm: null,
          notes: "",
        },
      ],
    })
  }

  const removeCutout = (index: number) => {
    updateLampCategory({
      cutouts: lampCategory.cutouts.filter((_, i) => i !== index),
    })
  }

  const saveSettings = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ settings }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setSettings(data.settings as AiSettingsDocument)
      setSuccess("KI-Modell-Konfiguration gespeichert.")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen."
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-16", adminUi.muted)}>
        <Loader2 className="h-5 w-5 animate-spin" />
        KI-Einstellungen werden geladen…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className={cn("text-xl font-bold", adminUi.heading)}>
          KI-Modell-Konfiguration
        </h2>
        <p className={cn("mt-2 text-sm", adminUi.muted)}>
          Technische Vorgaben für Text-to-3D und Image-to-3D — werden als strikte
          Restriktionen an die Generierungs-API übergeben.
        </p>
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

      <Card className={adminUi.card}>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className={cn("text-lg font-semibold", adminUi.heading)}>
                Kategorie: {lampCategory.name}
              </h3>
              <p className={cn("text-xs", adminUi.muted)}>ID: {lampCategory.id}</p>
            </div>
            <Switch
              checked={lampCategory.enabled}
              onCheckedChange={(checked) => updateLampCategory({ enabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label>System-Prompt für die KI</Label>
            <Textarea
              value={lampCategory.systemPrompt}
              onChange={(e) => updateLampCategory({ systemPrompt: e.target.value })}
              rows={6}
              placeholder="Du bist ein präziser 3D-Designer für Lampen…"
            />
          </div>

          <div className="space-y-3">
            <Label>Maximale Druckgrösse (Bambu Lab X1C, mm)</Label>
            <div className="grid grid-cols-3 gap-3">
              {(["x", "y", "z"] as const).map((axis) => (
                <div key={axis} className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">
                    {axis.toUpperCase()}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    step={0.1}
                    value={lampCategory.maxPrintSizeMm[axis]}
                    onChange={(e) =>
                      updateLampCategory({
                        maxPrintSizeMm: {
                          ...lampCategory.maxPrintSizeMm,
                          [axis]: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Feste Aussparungen / Bohrungen</Label>
              <Button type="button" size="sm" variant="outline" onClick={addCutout}>
                <Plus className="mr-1 h-4 w-4" />
                Aussparung
              </Button>
            </div>

            {lampCategory.cutouts.map((cutout, index) => (
              <div
                key={cutout.id}
                className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}
              >
                <div className="flex items-start justify-between gap-2">
                  <Input
                    value={cutout.label}
                    onChange={(e) => updateCutout(index, { label: e.target.value })}
                    placeholder="Bezeichnung"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => removeCutout(index)}
                    disabled={lampCategory.cutouts.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Ø (mm)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={cutout.diameterMm ?? ""}
                      onChange={(e) =>
                        updateCutout(index, {
                          diameterMm: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Breite (mm)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={cutout.widthMm ?? ""}
                      onChange={(e) =>
                        updateCutout(index, {
                          widthMm: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Höhe (mm)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={cutout.heightMm ?? ""}
                      onChange={(e) =>
                        updateCutout(index, {
                          heightMm: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tiefe (mm)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={cutout.depthMm ?? ""}
                      onChange={(e) =>
                        updateCutout(index, {
                          depthMm: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>
                <Textarea
                  value={cutout.notes}
                  onChange={(e) => updateCutout(index, { notes: e.target.value })}
                  rows={2}
                  placeholder="Position, Toleranz, Hinweise…"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={() => void saveSettings()} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          KI-Konfiguration speichern
        </Button>
      </div>
    </div>
  )
}
