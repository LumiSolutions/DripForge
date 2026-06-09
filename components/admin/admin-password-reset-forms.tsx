"use client"

import { FormEvent, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

export function AdminForgotPasswordForm() {
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
      const res = await fetch("/api/admin/auth/forgot-password", {
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
    <div className={cn("flex min-h-screen items-center justify-center px-4", adminUi.loginPage)}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/admin" className="inline-flex items-center gap-2">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2016.%20Mai%202026%2C%2022_19_51-CjFqSwPCG95cJ4BMP2Ono6hKObBX8y.png"
              alt="DripForge"
              width={36}
              height={36}
              className="rounded"
            />
            <span className="text-lg font-bold">
              <span className="text-orange-500">Drip</span>
              <span className={adminUi.brandText}>Forge</span>
            </span>
          </Link>
          <p className={cn("mt-3 text-sm", adminUi.muted)}>Admin — Passwort vergessen</p>
        </div>

        <form onSubmit={handleSubmit} className={cn("p-6", adminUi.loginCard)}>
          <div className={cn("mb-5 flex items-center gap-2", adminUi.loginTitle)}>
            <Mail className="h-4 w-4 text-orange-500" />
            <h1 className="text-sm font-semibold">Reset-Link anfordern</h1>
          </div>
          <p className={cn("mb-4 text-xs", adminUi.muted)}>
            Nur die konfigurierte Admin-E-Mail ist berechtigt.
          </p>
          <div className="space-y-2">
            <Label htmlFor="admin-forgot-email" className={adminUi.labelMuted}>
              Admin-E-Mail
            </Label>
            <Input
              id="admin-forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={adminUi.input}
            />
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {message && (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className={cn("mt-5 w-full font-semibold", adminUi.primaryBtn)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link senden"}
          </Button>
        </form>

        <p className="mt-6 text-center">
          <Link href="/admin" className={cn("text-xs transition-colors", adminUi.footerBtn)}>
            ← Zurueck zum Admin-Login
          </Link>
        </p>
      </div>
    </div>
  )
}

export function AdminResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [requiresTotp, setRequiresTotp] = useState(false)
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
        const data = (await res.json()) as {
          valid?: boolean
          type?: string
          requiresTotp?: boolean
        }
        setValidToken(Boolean(data.valid && data.type === "admin"))
        setRequiresTotp(Boolean(data.requiresTotp))
      } catch {
        setValidToken(false)
      }
    })()
  }, [token])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError("Passwoerter stimmen nicht ueberein.")
      return
    }

    if (requiresTotp && totpCode.length !== 6) {
      setError("Bitte geben Sie Ihren 6-stelligen 2FA-Code ein.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, totpCode }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Reset fehlgeschlagen")
      router.push("/admin")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  if (validToken === null) {
    return (
      <div className={cn("flex min-h-screen items-center justify-center", adminUi.loader)}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!validToken) {
    return (
      <div className={cn("flex min-h-screen items-center justify-center px-4", adminUi.loginPage)}>
        <div className={cn("max-w-sm p-6 text-center", adminUi.loginCard)}>
          <p className="text-sm text-red-600 dark:text-red-400">
            Dieser Link ist ungueltig oder abgelaufen.
          </p>
          <Link href="/admin/passwort-vergessen" className={cn("mt-4 inline-block text-xs", adminUi.footerBtn)}>
            Neuen Link anfordern
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex min-h-screen items-center justify-center px-4", adminUi.loginPage)}>
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className={cn("p-6", adminUi.loginCard)}>
          <div className={cn("mb-5 flex items-center gap-2", adminUi.loginTitle)}>
            <KeyRound className="h-4 w-4 text-orange-500" />
            <h1 className="text-sm font-semibold">Neues Admin-Passwort</h1>
          </div>

          {requiresTotp && (
            <p className={cn("mb-4 text-xs", adminUi.muted)}>
              Aus Sicherheitsgruenden ist Ihr aktueller 2FA-Code erforderlich.
              E-Mail allein reicht nicht aus.
            </p>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-new-password" className={adminUi.labelMuted}>
                Neues Passwort
              </Label>
              <Input
                id="admin-new-password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={adminUi.input}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-confirm-password" className={adminUi.labelMuted}>
                Passwort bestaetigen
              </Label>
              <Input
                id="admin-confirm-password"
                type="password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className={adminUi.input}
              />
            </div>

            {requiresTotp && (
              <div className="space-y-2">
                <Label htmlFor="admin-reset-totp" className={adminUi.labelMuted}>
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    2FA-Code
                  </span>
                </Label>
                <Input
                  id="admin-reset-totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) =>
                    setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  className={cn("text-center tracking-[0.3em]", adminUi.input)}
                  required
                />
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className={cn("mt-5 w-full font-semibold", adminUi.primaryBtn)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Passwort speichern"}
          </Button>
        </form>
      </div>
    </div>
  )
}
