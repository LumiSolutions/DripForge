"use client"

import { PageIndividualLaser } from "@/components/dripforge/views/page-individual-laser"
import { useCart } from "@/components/dripforge/cart-provider"
import { useShopNavigate } from "@/hooks/use-shop-navigate"

export default function KonfiguratorLaserPage() {
  const navigate = useShopNavigate()
  const { addToCart } = useCart()

  return <PageIndividualLaser setCurrentView={navigate} addToCart={addToCart} />
}
