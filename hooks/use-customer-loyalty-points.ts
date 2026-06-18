"use client"

import { useCallback, useEffect, useState } from "react"

type LoyaltyState = {
  loggedIn: boolean
  loading: boolean
  loyaltyPoints: number
  loyaltyBalanceChf: number
}

export function useCustomerLoyaltyPoints(): LoyaltyState & { refresh: () => Promise<void> } {
  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loyaltyPoints, setLoyaltyPoints] = useState(0)
  const [loyaltyBalanceChf, setLoyaltyBalanceChf] = useState(0)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/konto/me", { cache: "no-store" })
      if (!res.ok) {
        setLoggedIn(false)
        setLoyaltyPoints(0)
        setLoyaltyBalanceChf(0)
        return
      }
      const data = (await res.json()) as {
        account?: { loyaltyPoints?: number; loyaltyBalanceChf?: number }
      }
      setLoggedIn(true)
      setLoyaltyPoints(Number(data.account?.loyaltyPoints) || 0)
      setLoyaltyBalanceChf(Number(data.account?.loyaltyBalanceChf) || 0)
    } catch {
      setLoggedIn(false)
      setLoyaltyPoints(0)
      setLoyaltyBalanceChf(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { loggedIn, loading, loyaltyPoints, loyaltyBalanceChf, refresh }
}
