"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import {
  enableSiteConfigPreviewInSession,
  enableSiteConfigReadonlyInSession,
  SITE_CONFIG_PREVIEW_PARAM,
  SITE_CONFIG_READONLY_PARAM,
} from "@/lib/admin/site-config"
import { Button } from "@/components/ui/button"

/**
 * Tester-/Admin-Einstieg in die Staging-Testumgebung.
 * Setzt Preview + Readonly und leitet auf die Startseite um (ohne Edit-Overlays).
 */
export default function TestPreviewPage() {
  const [status, setStatus] = useState<"checking" | "redirecting" | "denied">("checking")

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch("/api/admin/auth/me", { credentials: "include" })
        const data = (await res.json().catch(() => null)) as {
          authenticated?: boolean
          role?: "admin" | "tester"
        } | null

        if (cancelled) return

        if (
          res.ok &&
          data?.authenticated &&
          (data.role === "admin" || data.role === "tester")
        ) {
          enableSiteConfigPreviewInSession()
          enableSiteConfigReadonlyInSession()
          setStatus("redirecting")
          window.location.replace(
            `/?${SITE_CONFIG_PREVIEW_PARAM}=true&${SITE_CONFIG_READONLY_PARAM}=1`
          )
          return
        }

        setStatus("denied")
      } catch {
        if (!cancelled) setStatus("denied")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (status === "denied") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Test-Umgebung</h1>
        <p className="text-sm text-muted-foreground">
          Für die Staging-Vorschau ist eine angemeldete Tester- oder Admin-Session erforderlich.
          Bitte zuerst über die Coming-Soon-Seite als Tester anmelden.
        </p>
        <Button asChild>
          <Link href="/">Zur Startseite</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Test-Vorschau wird geladen…
    </div>
  )
}
