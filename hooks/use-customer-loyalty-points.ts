"use client"

import { useCallback, useEffect, useState } from "react"
import type { CustomerProfileResponse } from "@/lib/konto/customer-profile-service"

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
      const res = await fetch("/api/customer/profile", {
        cache: "no-store",
        credentials: "include",
      })
      if (!res.ok) {
        setLoggedIn(false)
        setLoyaltyPoints(0)
        setLoyaltyBalanceChf(0)
        return
      }
      const data = (await res.json()) as { profile?: CustomerProfileResponse }
      setLoggedIn(true)
      setLoyaltyPoints(Number(data.profile?.loyaltyPoints) || 0)
      setLoyaltyBalanceChf(Number(data.profile?.loyaltyBalanceChf) || 0)
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
