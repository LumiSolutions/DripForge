"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { KontoShell } from "@/components/konto/konto-shell"

export function KontoForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const res = await fetch("/api/konto/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error ?? "Anfrage fehlgeschlagen")
      setMessage(
        data.message ??
          "Falls ein Konto existiert, erhalten Sie in Kuerze eine E-Mail."
      )
      setEmail("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anfrage fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KontoShell authMode>
      <Card className="rounded-2xl border-border/50">
        <CardContent className="space-y-6 p-8">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Passwort vergessen</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Link zum
            Zurücksetzen (gültig 1 Stunde).
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">E-Mail</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {message && <p className="text-sm text-emerald-600">{message}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Link anfordern
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/konto/login" className="font-medium text-primary hover:underline">
              Zurueck zum Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </KontoShell>
  )
}

export function KontoResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [validToken, setValidToken] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setValidToken(false)
      return
    }
    void (async () => {
      try {
        const res = await fetch(
          `/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`
        )
        const data = (await res.json()) as { valid?: boolean; type?: string }
        setValidToken(Boolean(data.valid && data.type === "customer"))
      } catch {
        setValidToken(false)
      }
    })()
  }, [token])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError("Passwörter stimmen nicht überein.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/konto/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.error ?? "Reset fehlgeschlagen")
      router.push("/konto/login")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  if (validToken === null) {
    return (
      <KontoShell authMode>
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </KontoShell>
    )
  }

  if (!validToken) {
    return (
      <KontoShell authMode>
        <Card className="rounded-2xl border-border/50">
          <CardContent className="space-y-4 p-8 text-center">
            <p className="text-sm text-red-500">
              Dieser Link ist ungültig oder abgelaufen.
            </p>
            <Link href="/konto/passwort-vergessen" className="text-sm text-primary hover:underline">
              Neuen Link anfordern
            </Link>
          </CardContent>
        </Card>
      </KontoShell>
    )
  }

  return (
    <KontoShell authMode>
      <Card className="rounded-2xl border-border/50">
        <CardContent className="space-y-6 p-8">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Neues Passwort festlegen</h1>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Neues Passwort</Label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Passwort bestaetigen</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Passwort speichern
            </Button>
          </form>
        </CardContent>
      </Card>
    </KontoShell>
  )
}
