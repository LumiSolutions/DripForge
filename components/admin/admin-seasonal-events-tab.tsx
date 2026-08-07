"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  normalizeCustomParticles,
  normalizeSeasonalSettings,
  type SeasonalEffect,
  type SeasonalEvent,
  type SeasonalSettings,
  type SeasonalThemeType,
} from "@/lib/dripforge/seasonal-events"
import { cn } from "@/lib/utils"

const EFFECTS: { value: SeasonalEffect; label: string }[] = [
  { value: "none", label: "Keine Animation" },
  { value: "snow", label: "Schnee" },
  { value: "hearts", label: "Herzen" },
  { value: "confetti", label: "Konfetti" },
  { value: "fireworks", label: "Feuerwerk" },
  { value: "flowers", label: "Blumen / Blütenregen" },
  { value: "pumpkins", label: "Kürbisse / Spinnenweben" },
  { value: "blackFriday", label: "Black Friday (Neon/Glitch)" },
  { value: "spooky", label: "Spooky-Akzente" },
  { value: "custom", label: "Custom / Eigenes Theme" },
]

const THEME_TYPES: { value: SeasonalThemeType; label: string }[] = [
  { value: "halloween", label: "Halloween" },
  { value: "christmas", label: "Weihnachten" },
  { value: "valentine", label: "Valentinstag" },
  { value: "easter", label: "Ostern" },
  { value: "summer", label: "Sommer-Special" },
  { value: "blackFriday", label: "Black Friday" },
  { value: "newYear", label: "Silvester" },
  { value: "spring", label: "Frühling / Muttertag" },
  { value: "custom", label: "Custom" },
]

type SeasonalApiPayload = {
  seasonal?: SeasonalSettings
  error?: string
}

function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : ""
}

function fromDateInput(value: string, endOfDay = false) {
  if (!value) return null
  return `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
}

export function AdminSeasonalEventsTab() {
  const [seasonal, setSeasonal] = useState<SeasonalSettings>(() =>
    normalizeSeasonalSettings(undefined)
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useMemo(
    () => seasonal.events.find((event) => event.id === seasonal.activeEventId) ?? null,
    [seasonal]
  )

  useEffect(() => {
    void fetch("/api/admin/seasonal-events", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        const data = (await res.json()) as SeasonalApiPayload
        if (!res.ok) throw new Error(data.error ?? "Saisons konnten nicht geladen werden.")
        setSeasonal(normalizeSeasonalSettings(data.seasonal))
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Saisons konnten nicht geladen werden.")
      )
      .finally(() => setLoading(false))
  }, [])

  const updateEvent = (id: string, patch: Partial<SeasonalEvent>) => {
    setSeasonal((prev) => ({
      ...prev,
      events: prev.events.map((event) =>
        event.id === id ? { ...event, ...patch } : event
      ),
    }))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/seasonal-events", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonal }),
      })
      const data = (await res.json()) as SeasonalApiPayload
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen.")
      setSeasonal(normalizeSeasonalSettings(data.seasonal))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p className={cn("flex items-center gap-2 py-12 text-sm", adminUi.muted)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Saisons werden geladen...
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={cn("text-xl font-bold", adminUi.heading)}>
          Saison- & Event-Manager
        </h2>
        <p className={cn("text-sm", adminUi.muted)}>
          Steuert Limited-Edition-Produkte, Shop-Badges und dezente Theme-Akzente.
        </p>
      </div>

      {error && <p className={adminUi.error}>{error}</p>}

      <div className={cn("rounded-xl border p-4", adminUi.section)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={cn("font-semibold", adminUi.heading)}>
              Saison-Theme aktivieren
            </p>
            <p className={cn("text-sm", adminUi.muted)}>
              Es ist immer nur ein aktives Theme auf der Storefront sichtbar.
            </p>
          </div>
          <Switch
            checked={seasonal.themeEnabled}
            onCheckedChange={(checked) =>
              setSeasonal((prev) => ({ ...prev, themeEnabled: checked }))
            }
          />
        </div>
        <div className="mt-4 max-w-sm space-y-2">
          <Label>Aktives Event</Label>
          <Select
            value={seasonal.activeEventId ?? "none"}
            onValueChange={(value) =>
              setSeasonal((prev) => ({
                ...prev,
                activeEventId: value === "none" ? null : value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Event</SelectItem>
              {seasonal.events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {active ? (
            <p className={cn("text-xs", adminUi.muted)}>
              Aktuell vorbereitet: {active.badgeLabel}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {seasonal.events.map((event) => (
          <div key={event.id} className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={cn("font-semibold", adminUi.heading)}>{event.name}</p>
                <p className={cn("text-xs", adminUi.muted)}>ID: {event.id}</p>
              </div>
              <Switch
                checked={event.enabled}
                onCheckedChange={(checked) => updateEvent(event.id, { enabled: checked })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={event.name}
                  onChange={(e) => updateEvent(event.id, { name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Theme-Typ</Label>
                <Select
                  value={event.themeType}
                  onValueChange={(value) =>
                    updateEvent(event.id, { themeType: value as SeasonalThemeType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEME_TYPES.map((theme) => (
                      <SelectItem key={theme.value} value={theme.value}>
                        {theme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Badge-Text</Label>
                <Input
                  value={event.badgeLabel}
                  onChange={(e) => updateEvent(event.id, { badgeLabel: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Akzentfarbe</Label>
                <Input
                  type="color"
                  value={event.accentColor}
                  onChange={(e) => updateEvent(event.id, { accentColor: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Effekt</Label>
                <Select
                  value={event.effect}
                  onValueChange={(value) =>
                    updateEvent(event.id, {
                      effect: value as SeasonalEffect,
                      ...(value === "custom" && !event.customParticles
                        ? {
                            customParticles: normalizeCustomParticles(undefined),
                          }
                        : {}),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EFFECTS.map((effect) => (
                      <SelectItem key={effect.value} value={effect.value}>
                        {effect.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Hero-Overlay</Label>
                <div className="flex h-9 items-center">
                  <Switch
                    checked={event.heroOverlay}
                    onCheckedChange={(checked) =>
                      updateEvent(event.id, { heroOverlay: checked })
                    }
                  />
                </div>
              </div>
              {event.effect === "custom" ? (
                <div className="space-y-3 sm:col-span-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Custom-Effekt-Mixer
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Icons / Emojis (Leerzeichen getrennt)</Label>
                      <Input
                        value={event.customParticles?.glyphs ?? ""}
                        onChange={(e) =>
                          updateEvent(event.id, {
                            customParticles: normalizeCustomParticles({
                              ...event.customParticles,
                              glyphs: e.target.value,
                            }),
                          })
                        }
                        placeholder="✦ ★ 🌸"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Partikel-Farbe</Label>
                      <Input
                        type="color"
                        value={event.customParticles?.color ?? event.accentColor}
                        onChange={(e) =>
                          updateEvent(event.id, {
                            customParticles: normalizeCustomParticles({
                              ...event.customParticles,
                              color: e.target.value,
                            }),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Dichte ({event.customParticles?.density ?? 18})</Label>
                      <Input
                        type="range"
                        min={4}
                        max={40}
                        value={event.customParticles?.density ?? 18}
                        onChange={(e) =>
                          updateEvent(event.id, {
                            customParticles: normalizeCustomParticles({
                              ...event.customParticles,
                              density: Number(e.target.value),
                            }),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        Geschwindigkeit ({event.customParticles?.speed ?? 1})
                      </Label>
                      <Input
                        type="range"
                        min={0.4}
                        max={2.5}
                        step={0.1}
                        value={event.customParticles?.speed ?? 1}
                        onChange={(e) =>
                          updateEvent(event.id, {
                            customParticles: normalizeCustomParticles({
                              ...event.customParticles,
                              speed: Number(e.target.value),
                            }),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label>Startdatum (optional)</Label>
                <Input
                  type="date"
                  value={toDateInput(event.startsAt)}
                  onChange={(e) =>
                    updateEvent(event.id, { startsAt: fromDateInput(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Enddatum (optional)</Label>
                <Input
                  type="date"
                  value={toDateInput(event.endsAt)}
                  onChange={(e) =>
                    updateEvent(event.id, { endsAt: fromDateInput(e.target.value, true) })
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" className={adminUi.primaryBtn} onClick={() => void save()}>
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Saison-Einstellungen speichern
      </Button>
    </div>
  )
}
