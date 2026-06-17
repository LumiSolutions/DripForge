"use client"

import { HomePage } from "@/components/dripforge/views/home-page"
import { useShopNavigate } from "@/hooks/use-shop-navigate"
import { useServiceVisibility } from "@/hooks/use-service-visibility"

export default function HomeRoutePage() {
  const navigate = useShopNavigate()
  const services = useServiceVisibility()

  return <HomePage setCurrentView={navigate} services={services} />
}
