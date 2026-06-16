"use client"

import { PageIndividual3D } from "@/components/dripforge/views/page-individual-3d"
import { useCart } from "@/components/dripforge/cart-provider"
import { StorefrontLayoutWrapper } from "@/components/dripforge/storefront-layout-wrapper"
import { useShopNavigate } from "@/hooks/use-shop-navigate"

function Individual3DContent() {
  const navigate = useShopNavigate()
  const { addToCart } = useCart()

  return <PageIndividual3D setCurrentView={navigate} addToCart={addToCart} />
}

export default function Individual3DPage() {
  return (
    <StorefrontLayoutWrapper>
      <Individual3DContent />
    </StorefrontLayoutWrapper>
  )
}
