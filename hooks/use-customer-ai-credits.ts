"use client"

import { useCallback, useEffect, useState } from "react"

export type CustomerAiCreditsState = {
  loggedIn: boolean
  loading: boolean
  aiCredits: number
  email: string | null
  refresh: () => Promise<void>
}

export function useCustomerAiCredits(): CustomerAiCreditsState {
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [aiCredits, setAiCredits] = useState(0)
  const [email, setEmail] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/konto/me", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) {
        setLoggedIn(false)
        setAiCredits(0)
        setEmail(null)
        return
      }
      const data = await res.json()
      setLoggedIn(true)
      setEmail(data.account?.email ?? null)
      setAiCredits(Number(data.account?.aiCredits) || 0)
    } catch {
      setLoggedIn(false)
      setAiCredits(0)
      setEmail(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { loggedIn, loading, aiCredits, email, refresh }
}
