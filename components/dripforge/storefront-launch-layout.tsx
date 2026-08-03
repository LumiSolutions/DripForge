"use client"

import type { ReactNode } from "react"
import { CartProvider } from "@/components/dripforge/cart-provider"
import { CustomerCategoryProvider } from "@/components/dripforge/customer-category-provider"
import { StorefrontShell } from "@/components/dripforge/storefront-shell"
import { VisitorHeartbeat } from "@/components/dripforge/visitor-heartbeat"

export function StorefrontLaunchLayout({ children }: { children: ReactNode }) {
  return (
    <CustomerCategoryProvider>
      <CartProvider>
        <VisitorHeartbeat />
        <StorefrontShell>{children}</StorefrontShell>
      </CartProvider>
    </CustomerCategoryProvider>
  )
}
