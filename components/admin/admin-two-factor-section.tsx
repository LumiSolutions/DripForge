"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { KeyRound, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

export function AdminTwoFactorSection() {
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/auth/me", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setTotpEnabled(Boolean(data.totpEnabled))
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const startReset = async () => {
    if (
      !confirm(
        "Neuen 2FA-QR-Code erzeugen? Der bisherige Authenticator-Eintrag wird ungueltig, bis Sie den neuen Code bestaetigen."
      )
    ) {
      return
    }

    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/auth/reset-totp", {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Reset fehlgeschlagen")
      setQrDataUrl(data.qrDataUrl ?? null)
      setTotpEnabled(false)
      setCode("")
      setSuccess(data.message ?? "Neuer QR-Code erstellt.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset fehlgeschlagen")
    } finally {
      setBusy(false)
    }
  }

  const activate = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/auth/activate-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Aktivierung fehlgeschlagen")
      setTotpEnabled(true)
      setQrDataUrl(null)
      setCode("")
      setSuccess(data.message ?? "2FA ist aktiv.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktivierung fehlgeschlagen")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Card className={adminUi.card}>
        <CardContent className="flex items-center gap-2 p-6 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Sicherheitseinstellungen werden geladen…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={adminUi.card}>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-orange-500" />
          <div>
            <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
              Zwei-Faktor-Authentisierung (2FA)
            </h3>
            <p className={cn("mt-1 text-sm", adminUi.muted)}>
              Authenticator-App (TOTP) fuer Admin-Zugang. Kunden-Logins sind nicht betroffen.
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            totpEnabled && !qrDataUrl
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : adminUi.section
          )}
        >
          Status:{" "}
          {totpEnabled && !qrDataUrl ? "Aktiv" : "Einrichtung ausstehend / wird aktualisiert"}
        </div>

        {error && <p className={adminUi.errorLg}>{error}</p>}
        {success && <p className={adminUi.success}>{success}</p>}

        {qrDataUrl && (
          <form onSubmit={(e) => void activate(e)} className="space-y-4">
            <p className={cn("text-sm", adminUi.muted)}>
              QR-Code scannen und mit einem 6-stelligen Code bestaetigen:
            </p>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="TOTP QR-Code"
                className="rounded-lg border border-zinc-700 bg-white p-2"
                width={200}
                height={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-2fa-code" className={adminUi.labelMuted}>
                Verifizierungscode
              </Label>
              <Input
                id="admin-2fa-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                className={cn("text-center tracking-[0.3em]", adminUi.input)}
              />
            </div>
            <Button
              type="submit"
              disabled={busy || code.length !== 6}
              className={adminUi.primaryBtn}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "2FA bestaetigen"}
            </Button>
          </form>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={() => void startReset()}
          disabled={busy}
          className={adminUi.outlineBtn}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="mr-2 h-4 w-4" />
          )}
          {totpEnabled ? "2FA neu einrichten" : "2FA einrichten"}
        </Button>
      </CardContent>
    </Card>
  )
}
