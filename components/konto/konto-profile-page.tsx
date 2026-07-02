"use client"

import { FormEvent, useEffect, useState } from "react"
import { KeyRound, Loader2, MapPin, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PasswordInput } from "@/components/ui/password-input"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { KontoShell } from "@/components/konto/konto-shell"
import type { CustomerProfileResponse } from "@/lib/konto/customer-profile-service"

type AddressForm = {
  firstName: string
  lastName: string
  street: string
  zip: string
  city: string
  phone: string
  email: string
  deliveryStreet: string
  deliveryZip: string
  deliveryCity: string
  deliverySameAsBilling: boolean
  kundennummer?: string
}

const EMPTY: AddressForm = {
  firstName: "",
  lastName: "",
  street: "",
  zip: "",
  city: "",
  phone: "",
  email: "",
  deliveryStreet: "",
  deliveryZip: "",
  deliveryCity: "",
  deliverySameAsBilling: true,
}

export function KontoProfilePage() {
  const [form, setForm] = useState<AddressForm>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [passwordCurrent, setPasswordCurrent] = useState("")
  const [passwordNew, setPasswordNew] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    void fetch("/api/customer/profile", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/konto/login?next=/konto/profil"
          return null
        }
        return res.ok ? res.json() : null
      })
      .then((data: { profile?: CustomerProfileResponse } | null) => {
        if (data?.profile) {
          setForm({
            firstName: data.profile.firstName ?? "",
            lastName: data.profile.lastName ?? "",
            street: data.profile.street ?? "",
            zip: data.profile.zip ?? "",
            city: data.profile.city ?? "",
            phone: data.profile.phone ?? "",
            email: data.profile.email ?? "",
            deliveryStreet: data.profile.deliveryStreet ?? data.profile.street ?? "",
            deliveryZip: data.profile.deliveryZip ?? data.profile.zip ?? "",
            deliveryCity: data.profile.deliveryCity ?? data.profile.city ?? "",
            deliverySameAsBilling: data.profile.deliverySameAsBilling ?? true,
            kundennummer: data.profile.kundennummer,
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          street: form.street,
          zip: form.zip,
          city: form.city,
          phone: form.phone,
          deliveryStreet: form.deliverySameAsBilling ? form.street : form.deliveryStreet,
          deliveryZip: form.deliverySameAsBilling ? form.zip : form.deliveryZip,
          deliveryCity: form.deliverySameAsBilling ? form.city : form.deliveryCity,
          deliverySameAsBilling: form.deliverySameAsBilling,
        }),
      })
      const data = (await res.json()) as { error?: string; profile?: CustomerProfileResponse }
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      if (data.profile) {
        setForm((prev) => ({
          ...prev,
          street: data.profile!.street ?? "",
          zip: data.profile!.zip ?? "",
          city: data.profile!.city ?? "",
          phone: data.profile!.phone ?? "",
          deliveryStreet: data.profile!.deliveryStreet ?? "",
          deliveryZip: data.profile!.deliveryZip ?? "",
          deliveryCity: data.profile!.deliveryCity ?? "",
          deliverySameAsBilling: data.profile!.deliverySameAsBilling ?? true,
        }))
      }
      setMessage("Adressdaten gespeichert — Checkout-Felder werden beim nächsten Einkauf vorausgefüllt.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen")
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordSaving(true)
    setPasswordError(null)
    setPasswordMessage(null)

    if (passwordNew !== passwordConfirm) {
      setPasswordError("Neues Passwort und Bestätigung stimmen nicht überein.")
      setPasswordSaving(false)
      return
    }

    try {
      const res = await fetch("/api/konto/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: passwordCurrent,
          newPassword: passwordNew,
        }),
      })
      const data = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error ?? "Passwort konnte nicht geändert werden.")
      setPasswordCurrent("")
      setPasswordNew("")
      setPasswordConfirm("")
      setPasswordMessage(data.message ?? "Passwort wurde geändert.")
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Passwort konnte nicht geändert werden.")
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch("/api/konto/delete", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      })

      let data: { error?: string; redirectUrl?: string; success?: boolean } = {}
      try {
        data = (await res.json()) as typeof data
      } catch {
        throw new Error("Server-Antwort ungültig.")
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Konto konnte nicht gelöscht werden.")
      }

      setDeleteDialogOpen(false)
      window.location.href = data.redirectUrl ?? "/"
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Konto konnte nicht gelöscht werden."
      )
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <KontoShell>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Profil wird geladen…
        </div>
      </KontoShell>
    )
  }

  const accountName = `${form.firstName} ${form.lastName}`.trim()

  return (
    <KontoShell accountName={accountName || undefined}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Profil &amp; Adressen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Name und E-Mail sind fest mit deinem Konto verknüpft. Adressdaten kannst du
            jederzeit anpassen.
          </p>
          {form.kundennummer ? (
            <p className="mt-2 font-mono text-sm text-primary">{form.kundennummer}</p>
          ) : null}
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Rechnungsadresse
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Vorname</Label>
                  <Input id="firstName" value={form.firstName} disabled readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nachname</Label>
                  <Input id="lastName" value={form.lastName} disabled readOnly />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" type="email" value={form.email} disabled readOnly />
                <p className="text-xs text-muted-foreground">
                  Vorname, Nachname und E-Mail können hier nicht geändert werden.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="street">Strasse / Nr.</Label>
                <Input
                  id="street"
                  value={form.street}
                  onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                  autoComplete="street-address"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="zip">PLZ</Label>
                  <Input
                    id="zip"
                    value={form.zip}
                    onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                    autoComplete="postal-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ort</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    autoComplete="address-level2"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefonnummer</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  autoComplete="tel"
                />
              </div>

              <div className="border-t border-border/50 pt-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  Lieferadresse
                </div>
                <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-border/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Gleich wie Rechnungsadresse</p>
                    <p className="text-xs text-muted-foreground">
                      Deaktivieren, um eine abweichende Lieferadresse zu hinterlegen.
                    </p>
                  </div>
                  <Switch
                    checked={form.deliverySameAsBilling}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, deliverySameAsBilling: checked }))
                    }
                  />
                </div>
                {!form.deliverySameAsBilling ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="deliveryStreet">Strasse / Nr. (Lieferung)</Label>
                      <Input
                        id="deliveryStreet"
                        value={form.deliveryStreet}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, deliveryStreet: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="deliveryZip">PLZ (Lieferung)</Label>
                        <Input
                          id="deliveryZip"
                          value={form.deliveryZip}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, deliveryZip: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deliveryCity">Ort (Lieferung)</Label>
                        <Input
                          id="deliveryCity"
                          value={form.deliveryCity}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, deliveryCity: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
              {message && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
              )}

              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Adressen speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={(e) => void handlePasswordSubmit(e)} className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <KeyRound className="h-4 w-4 text-primary" />
                Passwort ändern
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
                <PasswordInput
                  id="currentPassword"
                  value={passwordCurrent}
                  onChange={(e) => setPasswordCurrent(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Neues Passwort</Label>
                  <PasswordInput
                    id="newPassword"
                    value={passwordNew}
                    onChange={(e) => setPasswordNew(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
              {passwordMessage && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">{passwordMessage}</p>
              )}
              <Button type="submit" variant="outline" disabled={passwordSaving}>
                {passwordSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Passwort speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-red-500/30 bg-red-500/5">
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div>
              <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">
                Konto löschen
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Dein Konto wird unwiderruflich deaktiviert. Persönliche Daten werden
                anonymisiert. Bestellungen und Rechnungen bleiben aus
                buchhaltungsrechtlichen Gründen erhalten.
              </p>
            </div>

            {deleteError && (
              <p className="text-sm text-red-500">{deleteError}</p>
            )}

            <AlertDialog
              open={deleteDialogOpen}
              onOpenChange={(open) => {
                if (deleting) return
                setDeleteDialogOpen(open)
                if (!open) setDeleteError(null)
              }}
            >
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  className="w-full sm:w-auto"
                >
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Konto unwiderruflich löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Konto wirklich löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Deine
                    persönlichen Daten werden anonymisiert. Bestellungen und
                    Rechnungen bleiben für die Buchhaltung gespeichert. Du wirst
                    sofort abgemeldet.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteError && (
                  <p className="text-sm text-red-500" role="alert">
                    {deleteError}
                  </p>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void handleDeleteAccount()}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Wird gelöscht…
                      </>
                    ) : (
                      "Ja, Konto löschen"
                    )}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </KontoShell>
  )
}
