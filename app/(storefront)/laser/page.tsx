"use client"

import { PageLaser } from "@/components/dripforge/views/page-laser"
import { useShopNavigate } from "@/hooks/use-shop-navigate"
import { useServiceVisibility } from "@/hooks/use-service-visibility"

export default function LaserInfoPage() {
  const navigate = useShopNavigate()
  const { services } = useServiceVisibility()

  return <PageLaser setCurrentView={navigate} services={services} />
}
