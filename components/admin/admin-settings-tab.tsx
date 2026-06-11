"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Rocket, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import type { CompanySettings, ServiceVisibilitySettings } from "@/lib/admin/types"
import { DEFAULT_COMPANY_SETTINGS, DEFAULT_SERVICE_VISIBILITY } from "@/lib/admin/types"
import { AdminTesterPasswordSection } from "@/components/admin/admin-tester-password-section"
import { AdminTwoFactorSection } from "@/components/admin/admin-two-factor-section"
import { SERVICE_TOGGLE_OPTIONS } from "@/lib/dripforge/service-visibility"
import type { CheckoutRuntimeConfig } from "@/lib/dripforge/checkout-config"
import { DEFAULT_CHECKOUT_RUNTIME_CONFIG } from "@/lib/dripforge/checkout-config"
import { cn } from "@/lib/utils"

export function AdminSettingsTab() {
  const [checkout, setCheckout] = useState<CheckoutRuntimeConfig>(
    DEFAULT_CHECKOUT_RUNTIME_CONFIG
  )
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS)
  const [services, setServices] = useState<ServiceVisibilitySettings>(
    DEFAULT_SERVICE_VISIBILITY
  )
  const [shopLive, setShopLive] = useState(false)
  const [isSupportPageActive, setIsSupportPageActive] = useState(false)
  const [goingLive, setGoingLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/settings")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setCheckout(data.checkout ?? DEFAULT_CHECKOUT_RUNTIME_CONFIG)
      setCompany({ ...DEFAULT_COMPANY_SETTINGS, ...data.company })
      setShopLive(Boolean(data.launch?.shopLive))
      setIsSupportPageActive(Boolean(data.isSupportPageActive))
      setServices({ ...DEFAULT_SERVICE_VISIBILITY, ...data.services })
    } catch (err) {
      console.warn("Admin: Einstellungen konnten nicht geladen werden.", err)
      setError(
        err instanceof Error
          ? err.message
          : "Einstellungen konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkout, company, services, isSupportPageActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setCheckout(data.checkout)
      setCompany({ ...DEFAULT_COMPANY_SETTINGS, ...data.company })
      setIsSupportPageActive(Boolean(data.isSupportPageActive))
      setSuccess("Einstellungen gespeichert — Shop wird aktualisiert.")
    } catch (err) {
      console.warn("Admin: Einstellungen konnten nicht gespeichert werden.", err)
      setError(
        err instanceof Error
          ? err.message
          : "Einstellungen konnten nicht gespeichert werden."
      )
    } finally {
      setSaving(false)
    }
  }

  const goLive = async () => {
    if (
      !confirm(
        "Website jetzt offiziell live schalten? Die Coming-Soon-Seite wird für alle Besucher dauerhaft deaktiviert."
      )
    ) {
      return
    }

    setGoingLive(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/settings/go-live", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Live-Schaltung fehlgeschlagen")
      setShopLive(true)
      setSuccess(
        "Website ist offiziell live — Coming Soon ist für alle Besucher deaktiviert."
      )
    } catch (err) {
      console.warn("Admin: Live-Schaltung fehlgeschlagen.", err)
      setError(
        err instanceof Error ? err.message : "Live-Schaltung fehlgeschlagen."
      )
    } finally {
      setGoingLive(false)
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-24", adminUi.loader)}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Einstellungen werden geladen…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className={cn("text-xl font-bold", adminUi.heading)}>
          Globale Shop-Einstellungen
        </h2>
        <p className={cn("text-sm", adminUi.muted)}>
          Steuert Checkout-Verhalten, MwSt. und Firmendaten für den gesamten Shop
        </p>
      </div>

      {error && <p className={adminUi.errorLg}>{error}</p>}
      {success && <p className={adminUi.success}>{success}</p>}

      <AdminTwoFactorSection />

      <AdminTesterPasswordSection />

      <Card
        className={cn(
          adminUi.card,
          shopLive
            ? "border-emerald-500/40"
            : "border-orange-500/30 ring-1 ring-orange-500/20"
        )}
      >
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className={cn("text-lg font-bold", adminUi.heading)}>
              Website-Status
            </h3>
            <p className={cn("mt-1 text-sm", adminUi.muted)}>
              {shopLive
                ? "Die Website ist offiziell live. Alle Besucher sehen den vollen Shop."
                : "Vorschau-Modus aktiv: Besucher sehen die Coming-Soon-Seite bis zum Launch oder zur manuellen Freischaltung."}
            </p>
          </div>

          {shopLive ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Status: Live seit Freischaltung im Admin
            </div>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={() => void goLive()}
              disabled={goingLive}
              className={cn(
                "h-auto w-full py-4 text-base font-bold uppercase tracking-wide",
                adminUi.primaryBtn
              )}
            >
              {goingLive ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Rocket className="mr-2 h-5 w-5" />
              )}
              Website offiziell live schalten
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className={adminUi.card}>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
              Support-Kampagne
            </h3>
            <p className={cn("mt-1 text-sm", adminUi.muted)}>
              Steuert die Sichtbarkeit von «Unsere Mission» im Header und die Erreichbarkeit
              der Seite /support.
            </p>
          </div>
          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-xl border p-4",
              adminUi.section
            )}
          >
            <div className="space-y-1 pr-2">
              <Label className={cn("text-sm font-semibold", adminUi.heading)}>
                Support-Kampagne («Unsere Mission») auf der Website anzeigen
              </Label>
              <p className={cn("text-xs", adminUi.muted)}>
                Wenn deaktiviert, erscheint der Link weder im Desktop-Header noch als
                Mobile-Icon. Direktaufrufe von /support werden zur Startseite umgeleitet.
              </p>
            </div>
            <Switch
              checked={isSupportPageActive}
              onCheckedChange={setIsSupportPageActive}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={adminUi.card}>
        <CardContent className="space-y-6 p-6">
          <div>
            <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
              Dienstleistungen auf der Website
            </h3>
            <p className={cn("mt-1 text-sm", adminUi.muted)}>
              Steuert Navigation, Startseite und Kacheln. Deaktivierte Services bleiben im Code
              erhalten und können später aktiviert werden.
            </p>
          </div>

          <div className="space-y-3">
            {SERVICE_TOGGLE_OPTIONS.map((option) => (
              <div
                key={option.key}
                className={cn(
                  "flex items-start justify-between gap-4 rounded-xl border p-4",
                  adminUi.section
                )}
              >
                <div className="space-y-1 pr-2">
                  <Label className={cn("text-sm font-semibold", adminUi.heading)}>
                    {option.label}
                  </Label>
                  <p className={cn("text-xs", adminUi.muted)}>{option.description}</p>
                </div>
                <Switch
                  checked={services[option.key]}
                  onCheckedChange={(checked) =>
                    setServices((prev) => ({ ...prev, [option.key]: checked }))
                  }
                />
              </div>
            ))}
          </div>

          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-xl border p-4",
              adminUi.section
            )}
          >
            <div className="space-y-1">
              <Label className={cn("text-base font-semibold", adminUi.heading)}>
                MwSt.-Pflicht aktivieren
              </Label>
              <p className={cn("text-sm", adminUi.muted)}>
                Bei Aktivierung wird im Checkout die MwSt. ausgewiesen und berechnet.
                Deaktiviert = Kleinunternehmer-Modus ohne MwSt.
              </p>
            </div>
            <Switch
              checked={checkout.mwstAktiv}
              onCheckedChange={(checked) =>
                setCheckout((prev) => ({ ...prev, mwstAktiv: checked }))
              }
            />
          </div>

          <div className={cn("space-y-2 rounded-xl border p-4", adminUi.section)}>
            <Label className={adminUi.label}>MwSt.-Satz anpassen (%)</Label>
            <p className={cn("text-xs", adminUi.labelMuted)}>
              Aktuell gültiger Schweizer Normalsteuersatz: 8.1%. Änderungen gelten
              sofort im Checkout.
            </p>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={checkout.mwstSatz}
              onChange={(e) =>
                setCheckout((prev) => ({
                  ...prev,
                  mwstSatz: Number(e.target.value) || 8.1,
                }))
              }
              className={cn("max-w-[160px]", adminUi.input)}
            />
          </div>

          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-xl border p-4",
              adminUi.section
            )}
          >
            <div className="space-y-1">
              <Label className={cn("text-base font-semibold", adminUi.heading)}>
                Offizielles TWINT-Gateway aktivieren
              </Label>
              <p className={cn("text-sm", adminUi.muted)}>
                Bei Aktivierung wird die manuelle TWINT-Telefonnummer im Checkout
                ausgeblendet und das Gateway (Stripe/Payrexx API) vorbereitet.
                Deaktiviert = manuelle TWINT-Anweisung mit Telefonnummer.
              </p>
            </div>
            <Switch
              checked={checkout.twintGatewayAktiv}
              onCheckedChange={(checked) =>
                setCheckout((prev) => ({ ...prev, twintGatewayAktiv: checked }))
              }
            />
          </div>

          {!checkout.twintGatewayAktiv && (
            <div className="space-y-2 pl-1">
              <Label className={adminUi.label}>TWINT-Telefonnummer (manuell)</Label>
              <Input
                value={checkout.twintTelefonnummer}
                onChange={(e) =>
                  setCheckout((prev) => ({
                    ...prev,
                    twintTelefonnummer: e.target.value,
                  }))
                }
                className={adminUi.input}
              />
            </div>
          )}

          <div className={cn("space-y-4 border-t pt-6", adminUi.sidebarBorder)}>
            <div>
              <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
                Firmendaten & Bankverbindung
              </h3>
              <p className={cn("mt-1 text-sm", adminUi.muted)}>
                Für Footer, Impressum und Zahlungsart «Kauf auf Rechnung» / Vorkasse
              </p>
            </div>

            <div className="space-y-2">
              <Label className={adminUi.label}>Firmenname</Label>
              <Input
                value={company.firmenname}
                onChange={(e) =>
                  setCompany((prev) => ({ ...prev, firmenname: e.target.value }))
                }
                className={adminUi.input}
              />
            </div>

            <div className="space-y-2">
              <Label className={adminUi.label}>Kontakt-E-Mail</Label>
              <Input
                type="email"
                value={company.kontaktEmail}
                onChange={(e) =>
                  setCompany((prev) => ({ ...prev, kontaktEmail: e.target.value }))
                }
                placeholder="drip-forge@outlook.com"
                className={adminUi.input}
              />
            </div>

            <div className="space-y-2">
              <Label className={adminUi.label}>Firmenadresse</Label>
              <Textarea
                value={company.firmenAdresse}
                onChange={(e) =>
                  setCompany((prev) => ({ ...prev, firmenAdresse: e.target.value }))
                }
                rows={3}
                placeholder="Strasse, PLZ Ort&#10;Schweiz"
                className={adminUi.input}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className={adminUi.label}>IBAN</Label>
                <Input
                  value={company.iban}
                  onChange={(e) =>
                    setCompany((prev) => ({ ...prev, iban: e.target.value }))
                  }
                  placeholder="CH93 0076 2011 6238 5295 7"
                  className={cn("font-mono", adminUi.input)}
                />
              </div>
              <div className="space-y-2">
                <Label className={adminUi.label}>Bankname</Label>
                <Input
                  value={company.bankname}
                  onChange={(e) =>
                    setCompany((prev) => ({ ...prev, bankname: e.target.value }))
                  }
                  placeholder="PostFinance AG"
                  className={adminUi.input}
                />
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void saveSettings()}
            disabled={saving}
            className={cn("w-full", adminUi.primaryBtn)}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Einstellungen speichern
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
