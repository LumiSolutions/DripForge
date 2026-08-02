"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { shopViewHref } from "@/lib/dripforge/shop-routes"
import { safeNavigate } from "@/lib/dripforge/safe-navigate"

/** Ersetzt setCurrentView aus der alten SPA durch echte Next.js-Routen + Hard-Fallback. */
export function useShopNavigate() {
  const router = useRouter()

  return useCallback(
    (view: string) => {
      const href = shopViewHref(view)
      safeNavigate(href, {
        routerPush: (to) => {
          router.push(to)
        },
      })
    },
    [router]
  )
}
