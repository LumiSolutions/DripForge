"use client"

import { FormEvent, useState } from "react"
import { KeyRound, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

export function AdminPasswordChangeSection() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password.length < 8) {
      setError("Neues Passwort muss mindestens 8 Zeichen haben.")
      return
    }
    if (password !== confirmPassword) {
      setError("Neues Passwort und Bestätigung stimmen nicht überein.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/admin/staff/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: currentPassword.trim() || undefined,
          password,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        message?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Passwort konnte nicht geändert werden.")

      setSuccess(data.message ?? "Admin-Passwort wurde aktualisiert.")
      setCurrentPassword("")
      setPassword("")
      setConfirmPassword("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passwortänderung fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={adminUi.card}>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 text-orange-500" />
          <div>
            <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
              Admin-Passwort
            </h3>
            <p className={cn("mt-1 text-sm", adminUi.muted)}>
              Eigenes Admin-Passwort ändern. Aktuelles Passwort ist optional, da Sie
              bereits als Admin angemeldet sind.
            </p>
          </div>
        </div>

        {error && <p className={adminUi.errorLg}>{error}</p>}
        {success && <p className={adminUi.success}>{success}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="admin-current-password" className={adminUi.labelMuted}>
              Aktuelles Passwort (optional)
            </Label>
            <PasswordInput
              id="admin-current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Optional zur Bestätigung"
              className={adminUi.input}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-new-password" className={adminUi.labelMuted}>
              Neues Admin-Passwort
            </Label>
            <PasswordInput
              id="admin-new-password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 Zeichen"
              className={adminUi.input}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-confirm-password" className={adminUi.labelMuted}>
              Neues Passwort bestätigen
            </Label>
            <PasswordInput
              id="admin-confirm-password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Wiederholen"
              className={adminUi.input}
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !password.trim() || !confirmPassword.trim()}
            className={adminUi.primaryBtn}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Passwort ändern"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
