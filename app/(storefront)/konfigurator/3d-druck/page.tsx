"use client"

import { PageIndividual3D } from "@/components/dripforge/views/page-individual-3d"
import { useCart } from "@/components/dripforge/cart-provider"
import { useShopNavigate } from "@/hooks/use-shop-navigate"

export default function Konfigurator3DPage() {
  const navigate = useShopNavigate()
  const { addToCart } = useCart()

  return <PageIndividual3D setCurrentView={navigate} addToCart={addToCart} />
}
