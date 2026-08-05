"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type {
  PaymentMethodId,
  ShippingMethodId,
} from "@/lib/dripforge/checkout-config"
import { applyCategoryDiscount } from "@/lib/dripforge/customer-categories"

export type ResolvedCustomerCategory = {
  id: string
  name: string
  discountPercent: number
  allowedShippingMethodIds: ShippingMethodId[]
  allowedPaymentMethodIds: PaymentMethodId[]
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

export const CUSTOMER_CATEGORY_REFRESH_EVENT = "dripforge:auth-changed"

export function CustomerCategoryProvider({ children }: { children: ReactNode }) {
  const [category, setCategory] = useState<ResolvedCustomerCategory | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = useCallback(() => {
    setLoaded(false)
    setReloadKey((k) => k + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/customer/category", {
          cache: "no-store",
          credentials: "include",
        })
        const data = (await res.json().catch(() => null)) as {
          category?: ResolvedCustomerCategory | null
        } | null
        if (cancelled) return
        if (res.ok) {
          if (data && Object.prototype.hasOwnProperty.call(data, "category")) {
            setCategory(data.category ?? null)
          }
        }
      } catch {
        // Netzwerkfehler: Kategorie nicht zurücksetzen
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // Nach Login/Logout oder Tab-Fokus Kategorie neu laden.
  useEffect(() => {
    const onAuth = () => refresh()
    const onFocus = () => refresh()
    window.addEventListener(CUSTOMER_CATEGORY_REFRESH_EVENT, onAuth)
    window.addEventListener("focus", onFocus)
    return () => {
      window.removeEventListener(CUSTOMER_CATEGORY_REFRESH_EVENT, onAuth)
      window.removeEventListener("focus", onFocus)
    }
  }, [refresh])

  const value = useMemo<CustomerCategoryContextValue>(() => {
    const discountPercent = category?.discountPercent ?? 0
    return {
      category,
      discountPercent,
      loaded,
      applyDiscount: (price: number) =>
        applyCategoryDiscount(price, discountPercent),
      refresh,
    }
  }, [category, loaded, refresh])

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
