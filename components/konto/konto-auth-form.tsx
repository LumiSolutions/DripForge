"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Lock, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { KontoShell } from "@/components/konto/konto-shell"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { readClientCart, writeClientCart } from "@/lib/dripforge/cart-storage"
import type { CartItem } from "@/lib/dripforge/types"

export function KontoLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/konto"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/konto/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          guestCart: readClientCart(),
        }),
      })
      const data = (await res.json()) as { error?: string; cart?: CartItem[] }
      if (!res.ok) throw new Error(data.error ?? "Login fehlgeschlagen")
      if (Array.isArray(data.cart)) {
        writeClientCart(data.cart)
      }
      router.push(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KontoShell authMode>
      <Card className="rounded-2xl border-border/50">
        <CardContent className="space-y-6 p-8">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold"><SiteText k="konto_login_title" /></h1>
          </div>
          <p className="text-sm text-muted-foreground">
            <SiteText k="konto_login_subtitle" />
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Passwort</Label>
                <Link
                  href="/konto/passwort-vergessen"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Passwort vergessen?
                </Link>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Anmelden
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Noch kein Konto?{" "}
            <Link href="/konto/registrieren" className="font-medium text-primary hover:underline">
              Jetzt registrieren
            </Link>
          </p>
        </CardContent>
      </Card>
    </KontoShell>
  )
}

export function KontoRegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/konto"
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/konto/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          guestCart: readClientCart(),
        }),
      })
      const data = (await res.json()) as { error?: string; cart?: CartItem[] }
      if (!res.ok) throw new Error(data.error ?? "Registrierung fehlgeschlagen")
      if (Array.isArray(data.cart)) {
        writeClientCart(data.cart)
      }
      router.push(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrierung fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KontoShell authMode>
      <Card className="rounded-2xl border-border/50">
        <CardContent className="space-y-6 p-8">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold"><SiteText k="konto_register_title" /></h1>
          </div>
          <p className="text-sm text-muted-foreground">
            <SiteText k="konto_register_subtitle" />
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Vorname</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nachname</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">E-Mail</Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Passwort (min. 8 Zeichen)</Label>
              <PasswordInput
                id="reg-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Registrieren
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Bereits registriert?{" "}
            <Link href="/konto/login" className="font-medium text-primary hover:underline">
              Zum Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </KontoShell>
  )
}
