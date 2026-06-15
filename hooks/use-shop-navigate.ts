"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { shopViewHref } from "@/lib/dripforge/shop-routes"

/** Ersetzt setCurrentView aus der alten SPA durch echte Next.js-Routen. */
export function useShopNavigate() {
  const router = useRouter()

  return useCallback(
    (view: string) => {
      router.push(shopViewHref(view))
    },
    [router]
  )
}
