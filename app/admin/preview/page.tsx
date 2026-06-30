"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  enableSiteConfigPreviewInSession,
  SITE_CONFIG_PREVIEW_PARAM,
} from "@/lib/admin/site-config"

/** Aktiviert Staging-Vorschau und leitet zur Startseite weiter. */
export default function AdminPreviewPage() {
  const router = useRouter()

  useEffect(() => {
    enableSiteConfigPreviewInSession()
    router.replace(`/?${SITE_CONFIG_PREVIEW_PARAM}=true`)
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Vorschau wird geladen…
    </div>
  )
}
