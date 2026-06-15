"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { ComingSoonPage } from "@/components/dripforge/coming-soon-page"
import { SiteTextsProvider } from "@/components/dripforge/site-texts-provider"
import { CartProvider } from "@/components/dripforge/cart-provider"
import { StorefrontShell } from "@/components/dripforge/storefront-shell"

type LaunchStatus = {
  canAccessShop: boolean
  shopLive: boolean
  hasPreviewAccess: boolean
}

type LaunchApiPayload = {
  canAccessShop?: boolean
  shopLive?: boolean
  hasPreviewAccess?: boolean
  degraded?: boolean
  error?: string
}

function parseLaunchStatus(data: LaunchApiPayload): LaunchStatus {
  const hasPreviewAccess = Boolean(data.hasPreviewAccess)
  const shopLive = Boolean(data.shopLive)
  const canAccessShop =
    Boolean(data.canAccessShop) || hasPreviewAccess || shopLive

  return { canAccessShop, shopLive, hasPreviewAccess }
}

export function StorefrontLaunchLayout({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LaunchStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/launch", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as LaunchApiPayload

      if (!res.ok && !data.canAccessShop && !data.hasPreviewAccess) {
        console.warn("Launch-Gate: API-Fehler.", data.error ?? res.status)
      }

      setStatus(parseLaunchStatus(data))
    } catch (err) {
      console.warn("Launch-Gate: Status konnte nicht geladen werden.", err)
      setStatus({ canAccessShop: false, shopLive: false, hasPreviewAccess: false })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Wird geladen…
      </div>
    )
  }

  if (!status?.canAccessShop) {
    return (
      <SiteTextsProvider>
        <ComingSoonPage onAccessGranted={() => void loadStatus()} />
      </SiteTextsProvider>
    )
  }

  return (
    <SiteTextsProvider>
      <CartProvider>
        <StorefrontShell>{children}</StorefrontShell>
      </CartProvider>
    </SiteTextsProvider>
  )
}
