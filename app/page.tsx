"use client"

import { HomePage } from "@/components/dripforge/views/home-page"
import { StorefrontLayoutWrapper } from "@/components/dripforge/storefront-layout-wrapper"
import { useShopNavigate } from "@/hooks/use-shop-navigate"
import { useServiceVisibility } from "@/hooks/use-service-visibility"

function HomeContent() {
  const navigate = useShopNavigate()
  const services = useServiceVisibility()

  return <HomePage setCurrentView={navigate} services={services} />
}

export default function HomeRoutePage() {
  return (
    <StorefrontLayoutWrapper>
      <HomeContent />
    </StorefrontLayoutWrapper>
  )
}
