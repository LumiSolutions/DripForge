"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { safeSessionGet, safeSessionSet } from "@/lib/dripforge/safe-storage"

const STORAGE_KEY = "df-visitor-session"
const INTERVAL_MS = 45_000

export function VisitorHeartbeat() {
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    const beat = async () => {
      if (cancelled) return
      try {
        const sessionId = safeSessionGet(STORAGE_KEY)
        const res = await fetch("/api/analytics/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            path: pathname || "/",
          }),
          keepalive: true,
        })
        if (!res.ok) return
        const data = (await res.json()) as { sessionId?: string | null }
        if (data.sessionId) {
          safeSessionSet(STORAGE_KEY, data.sessionId)
        }
      } catch {
        /* ignore */
      }
    }

    void beat()
    const id = window.setInterval(() => void beat(), INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [pathname])

  return null
}
