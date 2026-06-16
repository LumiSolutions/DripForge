"use client"

import { PageIndividualLaser } from "@/components/dripforge/views/page-individual-laser"
import { useCart } from "@/components/dripforge/cart-provider"
import { StorefrontLayoutWrapper } from "@/components/dripforge/storefront-layout-wrapper"
import { useShopNavigate } from "@/hooks/use-shop-navigate"

function IndividualLaserContent() {
  const navigate = useShopNavigate()
  const { addToCart } = useCart()

  return <PageIndividualLaser setCurrentView={navigate} addToCart={addToCart} />
}

export default function IndividualLaserPage() {
  return (
    <StorefrontLayoutWrapper>
      <IndividualLaserContent />
    </StorefrontLayoutWrapper>
  )
}
