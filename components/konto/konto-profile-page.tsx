"use client"

import { FormEvent, useEffect, useState } from "react"
import { Loader2, MapPin, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KontoShell } from "@/components/konto/konto-shell"

type ProfileForm = {
  firstName: string
  lastName: string
  street: string
  zip: string
  city: string
  phone: string
  email: string
}

const EMPTY: ProfileForm = {
  firstName: "",
  lastName: "",
  street: "",
  zip: "",
  city: "",
  phone: "",
  email: "",
}

export function KontoProfilePage() {
  const [form, setForm] = useState<ProfileForm>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch("/api/konto/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { account?: ProfileForm } | null) => {
        if (data?.account) {
          setForm({
            firstName: data.account.firstName ?? "",
            lastName: data.account.lastName ?? "",
            street: data.account.street ?? "",
            zip: data.account.zip ?? "",
            city: data.account.city ?? "",
            phone: data.account.phone ?? "",
            email: data.account.email ?? "",
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
      const res = await fetch("/api/konto/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          street: form.street,
          zip: form.zip,
          city: form.city,
          phone: form.phone,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setMessage("Profil gespeichert — Checkout-Felder werden beim nächsten Einkauf vorausgefüllt.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen")
    } finally {
      setSaving(false)
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
            Diese Angaben werden beim Checkout automatisch übernommen.
          </p>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Kontaktdaten
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Vorname</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nachname</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" type="email" value={form.email} disabled />
                <p className="text-xs text-muted-foreground">
                  Die E-Mail-Adresse ist mit deinem Konto verknüpft und kann hier nicht geändert werden.
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
              {message && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
              )}

              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Speichern
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </KontoShell>
  )
}
