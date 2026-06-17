"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react"
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
  const [secretBase32, setSecretBase32] = useState<string | null>(null)
  const setupMaterialRef = useRef<{ qrDataUrl: string; secretBase32: string } | null>(
    null
  )
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

  const requestSetup = async (force: boolean) => {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (force) headers["x-confirm-reset"] = "1"

      const res = await fetch("/api/admin/auth/reset-totp", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ force }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Setup fehlgeschlagen")
      if (data.qrDataUrl && data.secretBase32) {
        setupMaterialRef.current = {
          qrDataUrl: data.qrDataUrl,
          secretBase32: data.secretBase32,
        }
      }
      setQrDataUrl(setupMaterialRef.current?.qrDataUrl ?? null)
      setSecretBase32(setupMaterialRef.current?.secretBase32 ?? null)
      if (force) setTotpEnabled(false)
      setCode("")
      setSuccess(data.message ?? "QR-Code bereit.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup fehlgeschlagen")
    } finally {
      setBusy(false)
    }
  }

  const beginSetup = async () => {
    if (totpEnabled) {
      if (
        !confirm(
          "2FA wirklich neu einrichten? Der bisherige Authenticator-Eintrag wird ungueltig, bis Sie den neuen Code bestaetigen."
        )
      ) {
        return
      }
      await requestSetup(true)
      return
    }
    await requestSetup(false)
  }

  const clearAllStaff2fa = async () => {
    if (
      !confirm(
        "Alle gespeicherten 2FA-Secrets (Admin + Tester) loeschen? Beide Rollen muessen 2FA beim naechsten Login neu einrichten."
      )
    ) {
      return
    }

    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/staff/clear-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: "all" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Zuruecksetzen fehlgeschlagen")
      setTotpEnabled(false)
      setQrDataUrl(null)
      setSecretBase32(null)
      setupMaterialRef.current = null
      setCode("")
      setSuccess(data.message ?? "2FA zurueckgesetzt.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zuruecksetzen fehlgeschlagen")
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
      const activeSecret =
        secretBase32 ?? setupMaterialRef.current?.secretBase32 ?? ""
      if (!activeSecret) {
        throw new Error("2FA-Secret fehlt. Bitte Setup erneut starten.")
      }

      const res = await fetch("/api/admin/auth/activate-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code, secretBase32: activeSecret }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Aktivierung fehlgeschlagen")
      setTotpEnabled(true)
      setQrDataUrl(null)
      setSecretBase32(null)
      setupMaterialRef.current = null
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
              Ein fester Authenticator-Eintrag pro Rolle (Admin/Tester). Der QR-Code
              erscheint nur bei der Ersteinrichtung.
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
          {totpEnabled && !qrDataUrl
            ? "Aktiv"
            : qrDataUrl
              ? "Ersteinrichtung — QR scannen, dann Code eingeben"
              : "Noch nicht eingerichtet"}
        </div>

        {error && <p className={adminUi.errorLg}>{error}</p>}
        {success && <p className={adminUi.success}>{success}</p>}

        {qrDataUrl && (
          <form onSubmit={(e) => void activate(e)} className="space-y-4">
            <p className={cn("text-sm", adminUi.muted)}>
              QR-Code scannen (mehrere Geraete nacheinander moeglich) oder
              Schlüssel manuell eintragen, dann mit einem 6-stelligen Code
              bestaetigen:
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
            {secretBase32 && (
              <div className="space-y-1">
                <Label className={adminUi.labelMuted}>Manueller Eintrag (Base32)</Label>
                <code className="block break-all rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-center text-xs tracking-wide text-zinc-200">
                  {secretBase32}
                </code>
              </div>
            )}
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

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void beginSetup()}
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

          <Button
            type="button"
            variant="outline"
            onClick={() => void clearAllStaff2fa()}
            disabled={busy}
            className={adminUi.outlineBtn}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            2FA komplett zuruecksetzen (Admin + Tester)
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
