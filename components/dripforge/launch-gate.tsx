"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import { ComingSoonPage } from "@/components/dripforge/coming-soon-page"

const DripForgeApp = dynamic(() => import("@/components/dripforge/dripforge-app"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      DripForge wird geladen…
    </div>
  ),
})

type LaunchStatus = {
  canAccessShop: boolean
  shopLive: boolean
  hasPreviewAccess: boolean
}

export default function LaunchGate() {
  const [status, setStatus] = useState<LaunchStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/launch", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatus({
        canAccessShop: Boolean(data.canAccessShop),
        shopLive: Boolean(data.shopLive),
        hasPreviewAccess: Boolean(data.hasPreviewAccess),
      })
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
    return <ComingSoonPage onAccessGranted={() => void loadStatus()} />
  }

  return <DripForgeApp />
}
