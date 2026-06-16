"use client"

import { PageKontakt } from "@/components/dripforge/views/page-kontakt"
import { StorefrontLayoutWrapper } from "@/components/dripforge/storefront-layout-wrapper"
import { useShopNavigate } from "@/hooks/use-shop-navigate"

function KontaktContent() {
  const navigate = useShopNavigate()

  return <PageKontakt setCurrentView={navigate} />
}

export default function KontaktPage() {
  return (
    <StorefrontLayoutWrapper>
      <KontaktContent />
    </StorefrontLayoutWrapper>
  )
}
