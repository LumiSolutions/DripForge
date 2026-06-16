"use client"

import { PageWarenkorb } from "@/components/dripforge/views/page-warenkorb"
import { useCart } from "@/components/dripforge/cart-provider"
import { StorefrontLayoutWrapper } from "@/components/dripforge/storefront-layout-wrapper"
import { useShopNavigate } from "@/hooks/use-shop-navigate"

function WarenkorbContent() {
  const navigate = useShopNavigate()
  const { cart, setCart } = useCart()

  return <PageWarenkorb setCurrentView={navigate} cart={cart} setCart={setCart} />
}

export default function WarenkorbPage() {
  return (
    <StorefrontLayoutWrapper>
      <WarenkorbContent />
    </StorefrontLayoutWrapper>
  )
}
