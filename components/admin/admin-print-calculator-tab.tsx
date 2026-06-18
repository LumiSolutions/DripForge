"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Calculator, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import type {
  PrintCalculatorMaterialProfile,
  PrintCalculatorPrinterProfile,
  PrintCalculatorSettings,
} from "@/lib/admin/print-calculator-types"
import { calculatePrintCostBreakdown } from "@/lib/dripforge/print-calculator-engine"
import { cn } from "@/lib/utils"

function chf(value: number): string {
  return `CHF ${value.toFixed(2)}`
}

function newPrinter(): PrintCalculatorPrinterProfile {
  return {
    id: `printer-${Date.now()}`,
    name: "Neuer Drucker",
    purchasePriceChf: 2000,
    depreciationHours: 4000,
    powerKw: 0.3,
  }
}

function newMaterial(): PrintCalculatorMaterialProfile {
  return {
    id: `material-${Date.now()}`,
    name: "Neues Filament",
    rollPriceChf: 25,
    rollWeightKg: 1,
    densityGPerCm3: 1.24,
  }
}

export function AdminPrintCalculatorTab() {
  const [settings, setSettings] = useState<PrintCalculatorSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [printerId, setPrinterId] = useState("")
  const [materialId, setMaterialId] = useState("")
  const [printHours, setPrintHours] = useState(2)
  const [printMinutes, setPrintMinutes] = useState(30)
  const [prepPostMinutes, setPrepPostMinutes] = useState(15)
  const [weightGrams, setWeightGrams] = useState(150)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/print-calculator", {
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      const next = data.settings as PrintCalculatorSettings
      setSettings(next)
      setPrinterId(next.global.defaultPrinterId)
      setMaterialId(next.global.defaultMaterialId)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Einstellungen konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const breakdown = useMemo(() => {
    if (!settings || !printerId || !materialId) return null
    try {
      return calculatePrintCostBreakdown(settings, {
        printerId,
        materialId,
        printHours,
        printMinutes,
        prepPostMinutes,
        weightGrams,
      })
    } catch {
      return null
    }
  }, [
    settings,
    printerId,
    materialId,
    printHours,
    printMinutes,
    prepPostMinutes,
    weightGrams,
  ])

  const saveSettings = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/print-calculator", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ settings }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setSettings(data.settings as PrintCalculatorSettings)
      setSuccess("Druck-Kalkulator-Einstellungen gespeichert.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.")
    } finally {
      setSaving(false)
    }
  }

  const updateGlobal = (patch: Partial<PrintCalculatorSettings["global"]>) => {
    setSettings((prev) =>
      prev ? { ...prev, global: { ...prev.global, ...patch } } : prev
    )
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-16", adminUi.muted)}>
        <Loader2 className="h-5 w-5 animate-spin" />
        Druck-Kalkulator wird geladen…
      </div>
    )
  }

  if (!settings) {
    return (
      <p className={adminUi.errorLg}>
        {error ?? "Einstellungen konnten nicht geladen werden."}
      </p>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold", adminUi.heading)}>
            Druck-Kalkulator
          </h1>
          <p className={cn("mt-1 text-sm", adminUi.muted)}>
            Kalibriere Selbstkosten und Endpreise für Kunden-Uploads (STL/OBJ) in CHF.
          </p>
        </div>
        <Button
          onClick={() => void saveSettings()}
          disabled={saving}
          className={adminUi.primaryBtn}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Einstellungen speichern
        </Button>
      </div>

      {error && <p className={adminUi.errorLg}>{error}</p>}
      {success && <p className={adminUi.success}>{success}</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={adminUi.card}>
          <CardContent className="space-y-5 p-6">
            <h2 className={cn("flex items-center gap-2 font-semibold", adminUi.heading)}>
              <Calculator className="h-4 w-4 text-orange-500" />
              Kalkulation
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Drucker</Label>
                <select
                  value={printerId}
                  onChange={(e) => setPrinterId(e.target.value)}
                  className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                >
                  {settings.printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Filament / Material</Label>
                <select
                  value={materialId}
                  onChange={(e) => setMaterialId(e.target.value)}
                  className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                >
                  {settings.materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Druckzeit (Stunden)</Label>
                <Input
                  type="number"
                  min={0}
                  value={printHours}
                  onChange={(e) => setPrintHours(Number(e.target.value) || 0)}
                  className={adminUi.input}
                />
              </div>
              <div className="space-y-2">
                <Label>Druckzeit (Minuten)</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={printMinutes}
                  onChange={(e) => setPrintMinutes(Number(e.target.value) || 0)}
                  className={adminUi.input}
                />
              </div>
              <div className="space-y-2">
                <Label>Vorbereitung & Nacharbeit (Min.)</Label>
                <Input
                  type="number"
                  min={0}
                  value={prepPostMinutes}
                  onChange={(e) => setPrepPostMinutes(Number(e.target.value) || 0)}
                  className={adminUi.input}
                />
              </div>
              <div className="space-y-2">
                <Label>Modellgewicht (g)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(Number(e.target.value) || 0)}
                  className={adminUi.input}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(adminUi.card, "border-orange-500/20 bg-orange-500/5")}>
          <CardContent className="space-y-3 p-6">
            <h2 className={cn("font-semibold", adminUi.heading)}>Selbstkosten & Endpreis</h2>
            {breakdown ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className={adminUi.muted}>Filamentkosten</dt>
                  <dd className="font-medium tabular-nums">{chf(breakdown.filamentCostChf)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className={adminUi.muted}>Stromkosten</dt>
                  <dd className="font-medium tabular-nums">{chf(breakdown.electricityCostChf)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className={adminUi.muted}>Maschinen-Abschreibung</dt>
                  <dd className="font-medium tabular-nums">
                    {chf(breakdown.depreciationCostChf)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className={adminUi.muted}>Arbeitszeit / Labor</dt>
                  <dd className="font-medium tabular-nums">{chf(breakdown.laborCostChf)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-orange-500/20 pt-2">
                  <dt className={adminUi.muted}>Zwischensumme</dt>
                  <dd className="font-medium tabular-nums">{chf(breakdown.subtotalChf)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className={adminUi.muted}>
                    Fehlerrate ({settings.global.errorRatePercent}%)
                  </dt>
                  <dd className="font-medium tabular-nums">{chf(breakdown.errorRateCostChf)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className={adminUi.muted}>Zwischensumme inkl. Fehlerrate</dt>
                  <dd className="font-medium tabular-nums">
                    {chf(breakdown.subtotalWithErrorChf)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-orange-500/30 pt-3 text-base">
                  <dt className="font-semibold">
                    Endpreis (× {settings.global.markupMultiplier})
                  </dt>
                  <dd className="font-bold tabular-nums text-orange-600 dark:text-orange-400">
                    {chf(breakdown.endPriceChf)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className={adminUi.muted}>Bitte gültige Profile wählen.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={adminUi.card}>
        <CardContent className="space-y-6 p-6">
          <h2 className={cn("font-semibold", adminUi.heading)}>Globale Parameter</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Stromkosten (CHF/kWh)</Label>
              <Input
                type="number"
                step={0.01}
                value={settings.global.electricityPriceChfPerKwh}
                onChange={(e) =>
                  updateGlobal({ electricityPriceChfPerKwh: Number(e.target.value) || 0 })
                }
                className={adminUi.input}
              />
            </div>
            <div className="space-y-2">
              <Label>Fehlerrate (%)</Label>
              <Input
                type="number"
                step={0.1}
                value={settings.global.errorRatePercent}
                onChange={(e) =>
                  updateGlobal({ errorRatePercent: Number(e.target.value) || 0 })
                }
                className={adminUi.input}
              />
            </div>
            <div className="space-y-2">
              <Label>Aufschlagfaktor</Label>
              <Input
                type="number"
                step={0.1}
                value={settings.global.markupMultiplier}
                onChange={(e) =>
                  updateGlobal({ markupMultiplier: Number(e.target.value) || 1 })
                }
                className={adminUi.input}
              />
            </div>
            <div className="space-y-2">
              <Label>Arbeitszeit (CHF/h)</Label>
              <Input
                type="number"
                step={1}
                value={settings.global.laborCostChfPerHour}
                onChange={(e) =>
                  updateGlobal({ laborCostChfPerHour: Number(e.target.value) || 0 })
                }
                className={adminUi.input}
              />
            </div>
            <div className="space-y-2">
              <Label>Auto-Offerte: g/h Druck</Label>
              <Input
                type="number"
                step={0.1}
                value={settings.global.defaultPrintGramsPerHour}
                onChange={(e) =>
                  updateGlobal({ defaultPrintGramsPerHour: Number(e.target.value) || 1 })
                }
                className={adminUi.input}
              />
            </div>
            <div className="space-y-2">
              <Label>Auto-Offerte: Vorbereitung (Min.)</Label>
              <Input
                type="number"
                value={settings.global.defaultPrepPostMinutes}
                onChange={(e) =>
                  updateGlobal({ defaultPrepPostMinutes: Number(e.target.value) || 0 })
                }
                className={adminUi.input}
              />
            </div>
            <div className="space-y-2">
              <Label>Setup-Gebühr Kunden-Offerte (CHF)</Label>
              <Input
                type="number"
                step={0.5}
                value={settings.global.setupFeeChf}
                onChange={(e) =>
                  updateGlobal({ setupFeeChf: Number(e.target.value) || 0 })
                }
                className={adminUi.input}
              />
            </div>
            <div className="space-y-2">
              <Label>Mehrfarben-Aufschlag (% pro Extra-Farbe)</Label>
              <Input
                type="number"
                value={settings.global.multiColorSurchargePercentPerExtra}
                onChange={(e) =>
                  updateGlobal({
                    multiColorSurchargePercentPerExtra: Number(e.target.value) || 0,
                  })
                }
                className={adminUi.input}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileListCard
          title="Drucker-Profile"
          addLabel="Drucker hinzufügen"
          onAdd={() =>
            setSettings((prev) =>
              prev ? { ...prev, printers: [...prev.printers, newPrinter()] } : prev
            )
          }
        >
          {settings.printers.map((printer, index) => (
            <div
              key={printer.id}
              className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}
            >
              <div className="flex items-center justify-between gap-2">
                <Label>Profil {index + 1}</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            printers: prev.printers.filter((p) => p.id !== printer.id),
                          }
                        : prev
                    )
                  }
                  disabled={settings.printers.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={printer.name}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          printers: prev.printers.map((p) =>
                            p.id === printer.id ? { ...p, name: e.target.value } : p
                          ),
                        }
                      : prev
                  )
                }
                className={adminUi.input}
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Einkauf CHF</Label>
                  <Input
                    type="number"
                    value={printer.purchasePriceChf}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              printers: prev.printers.map((p) =>
                                p.id === printer.id
                                  ? { ...p, purchasePriceChf: Number(e.target.value) || 0 }
                                  : p
                              ),
                            }
                          : prev
                      )
                    }
                    className={adminUi.input}
                  />
                </div>
                <div>
                  <Label className="text-xs">Abschreibung h</Label>
                  <Input
                    type="number"
                    value={printer.depreciationHours}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              printers: prev.printers.map((p) =>
                                p.id === printer.id
                                  ? {
                                      ...p,
                                      depreciationHours: Number(e.target.value) || 1,
                                    }
                                  : p
                              ),
                            }
                          : prev
                      )
                    }
                    className={adminUi.input}
                  />
                </div>
                <div>
                  <Label className="text-xs">kW</Label>
                  <Input
                    type="number"
                    step={0.01}
                    value={printer.powerKw}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              printers: prev.printers.map((p) =>
                                p.id === printer.id
                                  ? { ...p, powerKw: Number(e.target.value) || 0.01 }
                                  : p
                              ),
                            }
                          : prev
                      )
                    }
                    className={adminUi.input}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="default-printer"
                  checked={settings.global.defaultPrinterId === printer.id}
                  onChange={() => updateGlobal({ defaultPrinterId: printer.id })}
                />
                Standard für Auto-Offerte
              </label>
            </div>
          ))}
        </ProfileListCard>

        <ProfileListCard
          title="Material-Profile"
          addLabel="Material hinzufügen"
          onAdd={() =>
            setSettings((prev) =>
              prev ? { ...prev, materials: [...prev.materials, newMaterial()] } : prev
            )
          }
        >
          {settings.materials.map((material, index) => (
            <div
              key={material.id}
              className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}
            >
              <div className="flex items-center justify-between gap-2">
                <Label>Profil {index + 1}</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            materials: prev.materials.filter((m) => m.id !== material.id),
                          }
                        : prev
                      )
                  }
                  disabled={settings.materials.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={material.name}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          materials: prev.materials.map((m) =>
                            m.id === material.id ? { ...m, name: e.target.value } : m
                          ),
                        }
                      : prev
                  )
                }
                className={adminUi.input}
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Rolle CHF</Label>
                  <Input
                    type="number"
                    value={material.rollPriceChf}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              materials: prev.materials.map((m) =>
                                m.id === material.id
                                  ? { ...m, rollPriceChf: Number(e.target.value) || 0 }
                                  : m
                              ),
                            }
                          : prev
                      )
                    }
                    className={adminUi.input}
                  />
                </div>
                <div>
                  <Label className="text-xs">Rolle kg</Label>
                  <Input
                    type="number"
                    step={0.01}
                    value={material.rollWeightKg}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              materials: prev.materials.map((m) =>
                                m.id === material.id
                                  ? { ...m, rollWeightKg: Number(e.target.value) || 0.01 }
                                  : m
                              ),
                            }
                          : prev
                      )
                    }
                    className={adminUi.input}
                  />
                </div>
                <div>
                  <Label className="text-xs">Dichte g/cm³</Label>
                  <Input
                    type="number"
                    step={0.01}
                    value={material.densityGPerCm3}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              materials: prev.materials.map((m) =>
                                m.id === material.id
                                  ? {
                                      ...m,
                                      densityGPerCm3: Number(e.target.value) || 0.01,
                                    }
                                  : m
                              ),
                            }
                          : prev
                      )
                    }
                    className={adminUi.input}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="default-material"
                  checked={settings.global.defaultMaterialId === material.id}
                  onChange={() => updateGlobal({ defaultMaterialId: material.id })}
                />
                Standard für Auto-Offerte
              </label>
            </div>
          ))}
        </ProfileListCard>
      </div>
    </div>
  )
}

function ProfileListCard({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string
  addLabel: string
  onAdd: () => void
  children: React.ReactNode
}) {
  return (
    <Card className={adminUi.card}>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={cn("font-semibold", adminUi.heading)}>{title}</h2>
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {addLabel}
          </Button>
        </div>
        <div className="space-y-4">{children}</div>
      </CardContent>
    </Card>
  )
}
