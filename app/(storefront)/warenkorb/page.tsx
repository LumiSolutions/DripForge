"use client"

import { PageWarenkorb } from "@/components/dripforge/views/page-warenkorb"
import { useCart } from "@/components/dripforge/cart-provider"
import { useShopNavigate } from "@/hooks/use-shop-navigate"

export default function WarenkorbPage() {
  const navigate = useShopNavigate()
  const { cart, setCart } = useCart()

  return <PageWarenkorb setCurrentView={navigate} cart={cart} setCart={setCart} />
}
