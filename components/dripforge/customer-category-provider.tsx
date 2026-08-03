"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { ShippingMethodId } from "@/lib/dripforge/checkout-config"
import { applyCategoryDiscount } from "@/lib/dripforge/customer-categories"

export type ResolvedCustomerCategory = {
  id: string
  name: string
  discountPercent: number
  allowedShippingMethodIds: ShippingMethodId[]
}

type CustomerCategoryContextValue = {
  category: ResolvedCustomerCategory | null
  discountPercent: number
  loaded: boolean
  /** Wendet den Kategorierabatt auf einen Basispreis an. */
  applyDiscount: (price: number) => number
  refresh: () => void
}

const CustomerCategoryContext = createContext<CustomerCategoryContextValue | null>(
  null
)

export function CustomerCategoryProvider({ children }: { children: ReactNode }) {
  const [category, setCategory] = useState<ResolvedCustomerCategory | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/customer/category", { cache: "no-store" })
        const data = (await res.json().catch(() => null)) as {
          category?: ResolvedCustomerCategory | null
        } | null
        if (!cancelled) setCategory(data?.category ?? null)
      } catch {
        if (!cancelled) setCategory(null)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const value = useMemo<CustomerCategoryContextValue>(() => {
    const discountPercent = category?.discountPercent ?? 0
    return {
      category,
      discountPercent,
      loaded,
      applyDiscount: (price: number) =>
        applyCategoryDiscount(price, discountPercent),
      refresh: () => setReloadKey((k) => k + 1),
    }
  }, [category, loaded])

  return (
    <CustomerCategoryContext.Provider value={value}>
      {children}
    </CustomerCategoryContext.Provider>
  )
}

/**
 * Kundenkategorie-Rabatt für den aktuell eingeloggten Kunden.
 * Ausserhalb des Providers: neutral (kein Rabatt).
 */
export function useCustomerCategory(): CustomerCategoryContextValue {
  const ctx = useContext(CustomerCategoryContext)
  if (ctx) return ctx
  return {
    category: null,
    discountPercent: 0,
    loaded: true,
    applyDiscount: (price: number) => price,
    refresh: () => {},
  }
}
