"use client"

import { FormEvent, useEffect, useState } from "react"
import {
  Check,
  KeyRound,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import type { SavedDeliveryAddress } from "@/lib/konto/account-types"
import {
  newDeliveryAddressId,
  normalizeDeliveryAddresses,
  setDefaultDeliveryAddressId,
} from "@/lib/konto/delivery-addresses"

type AddressForm = {
  firstName: string
  lastName: string
  street: string
  zip: string
  city: string
  phone: string
  email: string
  kundennummer?: string
}

type DeliveryDraft = {
  id: string
  label: string
  firstName: string
  lastName: string
  company: string
  street: string
  zip: string
  city: string
}

const EMPTY: AddressForm = {
  firstName: "",
  lastName: "",
  street: "",
  zip: "",
  city: "",
  phone: "",
  email: "",
}

const EMPTY_DRAFT: DeliveryDraft = {
  id: "",
  label: "",
  firstName: "",
  lastName: "",
  company: "",
  street: "",
  zip: "",
  city: "",
}

export function KontoProfilePage() {
  const [form, setForm] = useState<AddressForm>(EMPTY)
  const [deliveryAddresses, setDeliveryAddresses] = useState<SavedDeliveryAddress[]>(
    []
  )
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null)
  const [deliveryDraft, setDeliveryDraft] = useState<DeliveryDraft>(EMPTY_DRAFT)
  const [addingDelivery, setAddingDelivery] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingDelivery, setSavingDelivery] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deliveryError, setDeliveryError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [passwordCurrent, setPasswordCurrent] = useState("")
  const [passwordNew, setPasswordNew] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const applyProfile = (profile: CustomerProfileResponse) => {
    setForm({
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      street: profile.street ?? "",
      zip: profile.zip ?? "",
      city: profile.city ?? "",
      phone: profile.phone ?? "",
      email: profile.email ?? "",
      kundennummer: profile.kundennummer,
    })
    setDeliveryAddresses(
      normalizeDeliveryAddresses(profile.deliveryAddresses, {
        deliveryStreet: profile.deliveryStreet,
        deliveryZip: profile.deliveryZip,
        deliveryCity: profile.deliveryCity,
        deliverySameAsBilling: profile.deliverySameAsBilling,
      })
    )
  }

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
        if (data?.profile) applyProfile(data.profile)
      })
      .finally(() => setLoading(false))
  }, [])

  const persistAddresses = async (
    nextAddresses: SavedDeliveryAddress[],
    billingOverride?: Partial<AddressForm>
  ) => {
    const billing = { ...form, ...billingOverride }
    const defaultId = nextAddresses.find((a) => a.isDefault)?.id
    const res = await fetch("/api/customer/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        street: billing.street,
        zip: billing.zip,
        city: billing.city,
        phone: billing.phone,
        deliverySameAsBilling: nextAddresses.length === 0,
        deliveryStreet: "",
        deliveryZip: "",
        deliveryCity: "",
        deliveryAddresses: nextAddresses,
        defaultDeliveryAddressId: defaultId,
      }),
    })
    const data = (await res.json()) as {
      error?: string
      profile?: CustomerProfileResponse
    }
    if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
    if (data.profile) applyProfile(data.profile)
    return data.profile
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await persistAddresses(deliveryAddresses)
      setMessage(
        "Adressdaten gespeichert — Checkout-Felder werden beim nächsten Einkauf vorausgefüllt."
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen")
    } finally {
      setSaving(false)
    }
  }

  const startAddDelivery = () => {
    setAddingDelivery(true)
    setEditingDeliveryId(null)
    setDeliveryError(null)
    setDeliveryDraft({
      id: newDeliveryAddressId(),
      label: deliveryAddresses.length === 0 ? "Hauptadresse" : "Lieferadresse",
      firstName: form.firstName || "",
      lastName: form.lastName || "",
      company: "",
      street: "",
      zip: "",
      city: "",
    })
  }

  const startEditDelivery = (address: SavedDeliveryAddress) => {
    setAddingDelivery(false)
    setEditingDeliveryId(address.id)
    setDeliveryError(null)
    setDeliveryDraft({
      id: address.id,
      label: address.label,
      firstName: address.firstName ?? "",
      lastName: address.lastName ?? "",
      company: address.company ?? "",
      street: address.street,
      zip: address.zip,
      city: address.city,
    })
  }

  const cancelDeliveryEdit = () => {
    setAddingDelivery(false)
    setEditingDeliveryId(null)
    setDeliveryDraft(EMPTY_DRAFT)
    setDeliveryError(null)
  }

  const saveDeliveryDraft = async () => {
    const street = deliveryDraft.street.trim()
    const zip = deliveryDraft.zip.trim()
    const city = deliveryDraft.city.trim()
    const label = deliveryDraft.label.trim() || "Lieferadresse"
    const firstName = deliveryDraft.firstName.trim()
    const lastName = deliveryDraft.lastName.trim()
    const company = deliveryDraft.company.trim()
    if (!street || !zip || !city) {
      setDeliveryError("Bitte Strasse, PLZ und Ort ausfüllen.")
      return
    }

    setSavingDelivery(true)
    setDeliveryError(null)
    setMessage(null)
    try {
      let next: SavedDeliveryAddress[]
      if (addingDelivery) {
        const entry: SavedDeliveryAddress = {
          id: deliveryDraft.id || newDeliveryAddressId(),
          label,
          street,
          zip,
          city,
          isDefault: deliveryAddresses.length === 0,
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(company ? { company } : {}),
        }
        next = normalizeDeliveryAddresses([...deliveryAddresses, entry], undefined, {
          defaultId: entry.isDefault
            ? entry.id
            : deliveryAddresses.find((a) => a.isDefault)?.id,
        })
      } else {
        next = normalizeDeliveryAddresses(
          deliveryAddresses.map((a) =>
            a.id === deliveryDraft.id
              ? {
                  ...a,
                  label,
                  street,
                  zip,
                  city,
                  firstName: firstName || undefined,
                  lastName: lastName || undefined,
                  company: company || undefined,
                }
              : a
          )
        )
      }
      await persistAddresses(next)
      cancelDeliveryEdit()
      setMessage("Lieferadresse gespeichert.")
    } catch (err) {
      setDeliveryError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen"
      )
    } finally {
      setSavingDelivery(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    setSavingDelivery(true)
    setDeliveryError(null)
    setMessage(null)
    try {
      const next = setDefaultDeliveryAddressId(deliveryAddresses, id)
      await persistAddresses(next)
      setMessage("Hauptadresse aktualisiert.")
    } catch (err) {
      setDeliveryError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen"
      )
    } finally {
      setSavingDelivery(false)
    }
  }

  const handleDeleteDelivery = async (id: string) => {
    setSavingDelivery(true)
    setDeliveryError(null)
    setMessage(null)
    try {
      const remaining = deliveryAddresses.filter((a) => a.id !== id)
      const next = normalizeDeliveryAddresses(remaining)
      await persistAddresses(next)
      if (editingDeliveryId === id) cancelDeliveryEdit()
      setMessage("Lieferadresse gelöscht.")
    } catch (err) {
      setDeliveryError(
        err instanceof Error ? err.message : "Löschen fehlgeschlagen"
      )
    } finally {
      setSavingDelivery(false)
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
  const showDeliveryForm = addingDelivery || editingDeliveryId != null

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

              {error && <p className="text-sm text-red-500">{error}</p>}
              {message && !deliveryError && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
              )}

              <Button type="submit" disabled={saving || savingDelivery}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Rechnungsadresse speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Lieferadressen
              </div>
              {!showDeliveryForm && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startAddDelivery}
                  disabled={savingDelivery}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Neue Adresse hinzufügen
                </Button>
              )}
            </div>

            {deliveryAddresses.length === 0 && !showDeliveryForm ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Lieferadressen hinterlegt. Beim Checkout kannst du die
                Rechnungsadresse nutzen oder hier Adressen speichern.
              </p>
            ) : (
              <ul className="space-y-3">
                {deliveryAddresses.map((address) => (
                  <li
                    key={address.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/50 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{address.label}</p>
                        {address.isDefault ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <Star className="h-3 w-3" />
                            Hauptadresse
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {(() => {
                          const name = [address.firstName, address.lastName]
                            .filter(Boolean)
                            .join(" ")
                          const prefix = [name, address.company]
                            .filter(Boolean)
                            .join(" · ")
                          const location = `${address.street}, ${address.zip} ${address.city}`
                          return prefix ? `${prefix} — ${location}` : location
                        })()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!address.isDefault && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={savingDelivery || showDeliveryForm}
                          onClick={() => void handleSetDefault(address.id)}
                          title="Als Hauptadresse setzen"
                        >
                          <Star className="h-3.5 w-3.5" />
                          <span className="sr-only">Hauptadresse</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={savingDelivery || showDeliveryForm}
                        onClick={() => startEditDelivery(address)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Bearbeiten</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={savingDelivery || showDeliveryForm}
                        onClick={() => void handleDeleteDelivery(address.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Löschen</span>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {showDeliveryForm ? (
              <div className="space-y-4 rounded-xl border border-border/50 p-4">
                <p className="text-sm font-medium">
                  {addingDelivery ? "Neue Lieferadresse" : "Lieferadresse bearbeiten"}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="deliveryLabel">Bezeichnung</Label>
                  <Input
                    id="deliveryLabel"
                    value={deliveryDraft.label}
                    onChange={(e) =>
                      setDeliveryDraft((d) => ({ ...d, label: e.target.value }))
                    }
                    placeholder="z. B. Büro, Elternhaus"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="deliveryFirstName">Vorname</Label>
                    <Input
                      id="deliveryFirstName"
                      value={deliveryDraft.firstName}
                      onChange={(e) =>
                        setDeliveryDraft((d) => ({
                          ...d,
                          firstName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliveryLastName">Nachname</Label>
                    <Input
                      id="deliveryLastName"
                      value={deliveryDraft.lastName}
                      onChange={(e) =>
                        setDeliveryDraft((d) => ({
                          ...d,
                          lastName: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryCompany">Firma</Label>
                  <Input
                    id="deliveryCompany"
                    value={deliveryDraft.company}
                    onChange={(e) =>
                      setDeliveryDraft((d) => ({
                        ...d,
                        company: e.target.value,
                      }))
                    }
                    placeholder="optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryStreet">Strasse / Nr.</Label>
                  <Input
                    id="deliveryStreet"
                    value={deliveryDraft.street}
                    onChange={(e) =>
                      setDeliveryDraft((d) => ({ ...d, street: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="deliveryZip">PLZ</Label>
                    <Input
                      id="deliveryZip"
                      value={deliveryDraft.zip}
                      onChange={(e) =>
                        setDeliveryDraft((d) => ({ ...d, zip: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliveryCity">Ort</Label>
                    <Input
                      id="deliveryCity"
                      value={deliveryDraft.city}
                      onChange={(e) =>
                        setDeliveryDraft((d) => ({ ...d, city: e.target.value }))
                      }
                    />
                  </div>
                </div>
                {deliveryError && (
                  <p className="text-sm text-red-500">{deliveryError}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={savingDelivery}
                    onClick={() => void saveDeliveryDraft()}
                  >
                    {savingDelivery ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Speichern
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={savingDelivery}
                    onClick={cancelDeliveryEdit}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : null}

            {deliveryError && !showDeliveryForm && (
              <p className="text-sm text-red-500">{deliveryError}</p>
            )}
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
