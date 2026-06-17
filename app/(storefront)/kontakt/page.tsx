"use client"

import { PageKontakt } from "@/components/dripforge/views/page-kontakt"
import { useShopNavigate } from "@/hooks/use-shop-navigate"

export default function KontaktPage() {
  const navigate = useShopNavigate()

  return <PageKontakt setCurrentView={navigate} />
}
