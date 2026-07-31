"use client"

import { ShopHeader } from "@/components/dripforge/shop-header"
import { CartProvider } from "@/components/dripforge/cart-provider"

export default function KontoLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <ShopHeader mode="link" />
        <div className="flex-1 py-12 md:py-14">{children}</div>
      </div>
    </CartProvider>
  )
}
