"use client"

import { useEffect, useState } from "react"
import { AdminSiteContentDashboard } from "@/components/admin/admin-site-content-dashboard"
import { StaffAuthFlow } from "@/components/admin/staff-auth-flow"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

export default function AdminContentPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/auth/me", { credentials: "include" })
        setIsLoggedIn(res.ok)
      } catch {
        setIsLoggedIn(false)
      } finally {
        setHydrated(true)
      }
    })()
  }, [])

  if (!hydrated) {
    return (
      <div className={cn("flex min-h-screen items-center justify-center", adminUi.loader)}>
        Wird geladen…
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className={cn("flex min-h-screen items-center justify-center px-4", adminUi.loginPage)}>
        <StaffAuthFlow
          role="admin"
          intent="admin"
          title="CMS — Anmelden"
          subtitle="Texte & Inhalte verwalten"
          passwordPlaceholder="Admin-Passwort"
          onSuccess={() => setIsLoggedIn(true)}
        />
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen px-4 py-8 sm:px-6 lg:px-8", adminUi.page)}>
      <AdminSiteContentDashboard />
    </div>
  )
}
