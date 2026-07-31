"use client"

import { ShopHeader } from "@/components/dripforge/shop-header"
import { CartProvider, useCart } from "@/components/dripforge/cart-provider"

function KontoShopHeader() {
  const { cart } = useCart()
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  return <ShopHeader mode="link" cartCount={cartCount} />
}

export default function KontoLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <KontoShopHeader />
        <div className="flex-1 py-12 md:py-14">{children}</div>
      </div>
    </CartProvider>
  )
}
