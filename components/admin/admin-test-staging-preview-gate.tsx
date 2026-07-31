"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { StaffAuthFlow } from "@/components/admin/staff-auth-flow"
import { AdminTestStagingPreview } from "@/components/admin/admin-test-staging-preview"
import { Button } from "@/components/ui/button"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type AuthState = "checking" | "admin" | "tester" | "denied"

/**
 * RBAC-Gate: Admin- oder Tester-Session (2FA) für die reine Staging-Vorschau.
 */
export function AdminTestStagingPreviewGate() {
  const [auth, setAuth] = useState<AuthState>("checking")
  const [loginRole, setLoginRole] = useState<"admin" | "tester">("tester")

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/admin/auth/me", { credentials: "include" })
      const data = (await res.json().catch(() => null)) as {
        authenticated?: boolean
        role?: "admin" | "tester"
      } | null
      if (
        res.ok &&
        data?.authenticated &&
        (data.role === "admin" || data.role === "tester")
      ) {
        setAuth(data.role)
        return
      }
      setAuth("denied")
    } catch {
      setAuth("denied")
    }
  }

  useEffect(() => {
    void checkAuth()
  }, [])

  if (auth === "checking") {
    return (
      <div className={cn("flex min-h-screen items-center justify-center gap-2", adminUi.loader)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Berechtigung wird geprüft…
      </div>
    )
  }

  if (auth === "denied") {
    return (
      <div className={cn("flex min-h-screen flex-col items-center justify-center gap-6 px-4", adminUi.loginPage)}>
        <div className="w-full max-w-md space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Staging-Testvorschau</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Anmeldung als Tester oder Admin erforderlich (ohne Bearbeitungswerkzeuge).
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={loginRole === "tester" ? "default" : "outline"}
              onClick={() => setLoginRole("tester")}
            >
              Tester
            </Button>
            <Button
              type="button"
              size="sm"
              variant={loginRole === "admin" ? "default" : "outline"}
              onClick={() => setLoginRole("admin")}
            >
              Admin
            </Button>
          </div>
          <StaffAuthFlow
            key={loginRole}
            role={loginRole}
            intent={loginRole === "admin" ? "admin" : "preview"}
            title="Anmelden"
            subtitle={
              loginRole === "tester" ? "Tester-Zugang" : "Admin-Zugang"
            }
            passwordPlaceholder={
              loginRole === "tester" ? "Tester-Passwort" : "Admin-Passwort"
            }
            onSuccess={() => void checkAuth()}
          />
          <div className="text-center">
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href={adminPortalPath("/test")}>Zur Test-Umgebung</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen px-3 py-4 sm:px-6", adminUi.page)}>
      <AdminTestStagingPreview />
    </div>
  )
}
