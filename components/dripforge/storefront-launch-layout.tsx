"use client"

import type { ReactNode } from "react"
import { CartProvider } from "@/components/dripforge/cart-provider"
import { StorefrontShell } from "@/components/dripforge/storefront-shell"

export function StorefrontLaunchLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <StorefrontShell>{children}</StorefrontShell>
    </CartProvider>
  )
}
