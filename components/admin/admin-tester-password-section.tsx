"use client"

import { FormEvent, useState } from "react"
import { KeyRound, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

export function AdminTesterPasswordSection() {
  const [password, setPassword] = useState("")
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const resetPassword = async (generateTemporary: boolean) => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setTemporaryPassword(null)

    try {
      const res = await fetch("/api/admin/staff/tester/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          generateTemporary
            ? { generateTemporary: true }
            : { password }
        ),
      })
      const data = (await res.json()) as {
        error?: string
        message?: string
        temporaryPassword?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Reset fehlgeschlagen")

      setSuccess(data.message ?? "Tester-Passwort aktualisiert.")
      if (data.temporaryPassword) {
        setTemporaryPassword(data.temporaryPassword)
      }
      setPassword("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen haben.")
      return
    }
    void resetPassword(false)
  }

  return (
    <Card className={adminUi.card}>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 text-orange-500" />
          <div>
            <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
              Tester-Passwort
            </h3>
            <p className={cn("mt-1 text-sm", adminUi.muted)}>
              Tester koennen ihr Passwort nicht per E-Mail zuruecksetzen. Setzen Sie
              hier ein neues Passwort oder erzeugen Sie ein temporaeres.
            </p>
          </div>
        </div>

        {error && <p className={adminUi.errorLg}>{error}</p>}
        {success && <p className={adminUi.success}>{success}</p>}

        {temporaryPassword && (
          <div className={cn("rounded-xl border p-4", adminUi.section)}>
            <p className={cn("text-xs", adminUi.muted)}>Temporaeres Passwort:</p>
            <p className="mt-1 font-mono text-sm font-semibold">{temporaryPassword}</p>
            <p className={cn("mt-2 text-xs", adminUi.muted)}>
              Bitte dem Tester sicher mitteilen. Beim naechsten Login ist 2FA weiterhin erforderlich.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="tester-password" className={adminUi.labelMuted}>
              Neues Tester-Passwort
            </Label>
            <Input
              id="tester-password"
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 Zeichen"
              className={adminUi.input}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={loading || !password.trim()}
              className={adminUi.primaryBtn}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Passwort setzen"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void resetPassword(true)}
              className={adminUi.outlineBtn}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Temporaeres Passwort
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
