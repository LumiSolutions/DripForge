"use client"

import { FormEvent, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import type { StaffAuthIntent, StaffRole } from "@/lib/admin/staff-types"
import { cn } from "@/lib/utils"

type AuthStep = "password" | "setup" | "totp"

type StaffAuthFlowProps = {
  role: StaffRole
  intent: StaffAuthIntent
  title: string
  subtitle?: string
  passwordPlaceholder?: string
  submitLabel?: string
  onSuccess: () => void
  compact?: boolean
  showBackLink?: boolean
}

export function StaffAuthFlow({
  role,
  intent,
  title,
  subtitle,
  passwordPlaceholder = "Passwort",
  submitLabel = "Anmelden",
  onSuccess,
  compact = false,
  showBackLink = true,
}: StaffAuthFlowProps) {
  const [step, setStep] = useState<AuthStep>("password")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [secretBase32, setSecretBase32] = useState<string | null>(null)
  const setupMaterialRef = useRef<{ qrDataUrl: string; secretBase32: string } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const applySetupMaterial = (qr: string, secret: string) => {
    setupMaterialRef.current = { qrDataUrl: qr, secretBase32: secret }
    setQrDataUrl(qr)
    setSecretBase32(secret)
  }

  const loadSetupMaterial = async () => {
    const setupRes = await fetch("/api/admin/auth/setup-totp", {
      method: "POST",
      credentials: "include",
    })
    const setupData = (await setupRes.json()) as {
      error?: string
      qrDataUrl?: string
      secretBase32?: string
    }
    if (!setupRes.ok) {
      throw new Error(setupData.error ?? "2FA-Einrichtung fehlgeschlagen")
    }
    if (!setupData.qrDataUrl || !setupData.secretBase32) {
      throw new Error(
        "QR-Code konnte nicht geladen werden. Bitte erneut versuchen oder ENABLE_ADMIN_2FA prüfen."
      )
    }
    applySetupMaterial(setupData.qrDataUrl, setupData.secretBase32)
    setStep("setup")
    setCode("")
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role, password, intent }),
      })
      const data = (await res.json()) as {
        error?: string
        step?: AuthStep
        needsTotpSetup?: boolean
        success?: boolean
        message?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Anmeldung fehlgeschlagen")

      // ENABLE_ADMIN_2FA=false → Session direkt, kein TOTP-Schritt
      if (!data.step) {
        setPassword("")
        onSuccess()
        return
      }

      if (data.step === "setup" || data.needsTotpSetup) {
        await loadSetupMaterial()
      } else {
        setQrDataUrl(null)
        setSecretBase32(null)
        setupMaterialRef.current = null
        setStep("totp")
      }

      setPassword("")
      setCode("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  const handleTotpSubmit = async (e: FormEvent, isSetup: boolean) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const endpoint = isSetup
        ? "/api/admin/auth/confirm-totp"
        : "/api/admin/auth/verify-totp"

      const secret =
        setupMaterialRef.current?.secretBase32 ?? secretBase32 ?? undefined

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code,
          ...(isSetup && secret ? { secretBase32: secret } : {}),
        }),
      })
      const data = (await res.json()) as {
        error?: string
        needsTotpSetup?: boolean
      }
      if (!res.ok) {
        if (data.needsTotpSetup || /noch nicht eingerichtet/i.test(data.error ?? "")) {
          await loadSetupMaterial()
          setError(
            "2FA muss neu eingerichtet werden. Bitte QR-Code scannen und Code bestätigen."
          )
          return
        }
        throw new Error(data.error ?? "Verifizierung fehlgeschlagen")
      }

      setCode("")
      onSuccess()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Verifizierung fehlgeschlagen"
      )
    } finally {
      setLoading(false)
    }
  }

  const handleRetrySetup = async () => {
    setError(null)
    setLoading(true)
    try {
      await loadSetupMaterial()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "2FA-Einrichtung fehlgeschlagen"
      )
    } finally {
      setLoading(false)
    }
  }

  const cardClass = compact
    ? "rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4 shadow-2xl ring-1 ring-orange-500/10"
    : cn("p-6", adminUi.loginCard)

  return (
    <div className={compact ? "w-full max-w-xs" : "w-full max-w-sm"}>
      {!compact && (
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image
              src="/placeholder.svg"
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
          <p className={cn("mt-3 text-sm", adminUi.muted)}>{subtitle}</p>
        </div>
      )}

      {step === "password" && (
        <form onSubmit={(e) => void handlePasswordSubmit(e)} className={cardClass}>
          <div
            className={cn(
              "mb-5 flex items-center gap-2",
              compact ? "text-sm text-zinc-400" : adminUi.loginTitle
            )}
          >
            <Lock className="h-4 w-4 text-orange-500" />
            <h1 className="text-sm font-semibold">{title}</h1>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="staff-password"
                className={compact ? "text-xs text-zinc-500" : adminUi.labelMuted}
              >
                Passwort
              </Label>
              {role === "admin" && intent === "admin" && !compact && (
                <Link
                  href={adminPortalPath("/passwort-vergessen")}
                  className={cn("text-xs transition-colors", adminUi.footerBtn)}
                >
                  Passwort vergessen?
                </Link>
              )}
            </div>
            <PasswordInput
              id="staff-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={passwordPlaceholder}
              className={compact ? "border-zinc-800 bg-black/60 text-white" : adminUi.input}
            />
          </div>

          {error && (
            <p
              className={cn(
                "mt-3 text-sm",
                compact ? "text-xs text-red-400" : "text-red-600 dark:text-red-400"
              )}
              role="alert"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || !password.trim()}
            className={cn(
              "mt-5 w-full font-semibold",
              compact ? "bg-orange-500 hover:bg-orange-600" : adminUi.primaryBtn
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
          </Button>
        </form>
      )}

      {(step === "setup" || step === "totp") && (
        <form
          onSubmit={(e) => void handleTotpSubmit(e, step === "setup")}
          className={cardClass}
        >
          <div
            className={cn(
              "mb-4 flex items-center gap-2",
              compact ? "text-sm text-zinc-400" : adminUi.loginTitle
            )}
          >
            {step === "setup" ? (
              <KeyRound className="h-4 w-4 text-orange-500" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-orange-500" />
            )}
            <h1 className="text-sm font-semibold">
              {step === "setup"
                ? "2FA einrichten"
                : "Zwei-Faktor-Code"}
            </h1>
          </div>

          {step === "setup" && qrDataUrl && (
            <div className="mb-4 flex flex-col items-center gap-3">
              <p
                className={cn(
                  "text-center text-xs",
                  compact ? "text-zinc-500" : adminUi.muted
                )}
              >
                QR-Code mit Google Authenticator, Microsoft Authenticator o.&auml;.
                scannen. Beide Handys können nacheinander denselben Code
                erfassen, bevor Sie den 6-stelligen Code bestaetigen.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="TOTP QR-Code"
                className="rounded-lg border border-zinc-700 bg-white p-2"
                width={220}
                height={220}
              />
              {secretBase32 && (
                <div className="w-full space-y-1">
                  <p
                    className={cn(
                      "text-center text-xs font-medium",
                      compact ? "text-zinc-400" : adminUi.muted
                    )}
                  >
                    Manueller Eintrag (Base32)
                  </p>
                  <code
                    className={cn(
                      "block break-all rounded-md border px-2 py-1.5 text-center text-[11px] tracking-wide",
                      compact
                        ? "border-zinc-800 bg-black/60 text-zinc-300"
                        : "border-zinc-700 bg-zinc-900/80 text-zinc-200"
                    )}
                  >
                    {secretBase32}
                  </code>
                </div>
              )}
            </div>
          )}

          {step === "setup" && !qrDataUrl && (
            <div className="mb-4 space-y-3 text-center">
              <p
                className={cn(
                  "text-xs",
                  compact ? "text-zinc-500" : adminUi.muted
                )}
              >
                QR-Code wird geladen oder konnte nicht angezeigt werden.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => void handleRetrySetup()}
                className={cn(
                  "w-full",
                  compact ? "border-zinc-700 text-zinc-200" : undefined
                )}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "QR-Code erneut laden"
                )}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label
              htmlFor="staff-totp"
              className={compact ? "text-xs text-zinc-500" : adminUi.labelMuted}
            >
              6-stelliger Code
            </Label>
            <Input
              id="staff-totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className={cn(
                "text-center tracking-[0.3em]",
                compact ? "border-zinc-800 bg-black/60 text-white" : adminUi.input
              )}
              disabled={step === "setup" && !qrDataUrl}
            />
          </div>

          {error && (
            <p
              className={cn(
                "mt-3 text-sm",
                compact ? "text-xs text-red-400" : "text-red-600 dark:text-red-400"
              )}
              role="alert"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={
              loading || code.length !== 6 || (step === "setup" && !qrDataUrl)
            }
            className={cn(
              "mt-5 w-full font-semibold",
              compact ? "bg-orange-500 hover:bg-orange-600" : adminUi.primaryBtn
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : step === "setup" ? (
              "2FA aktivieren"
            ) : (
              "Verifizieren"
            )}
          </Button>
        </form>
      )}

      {showBackLink && !compact && (
        <p className="mt-6 text-center">
          <Link href="/" className={cn("text-xs transition-colors", adminUi.footerBtn)}>
            ← Zurueck zum Shop
          </Link>
        </p>
      )}
    </div>
  )
}
