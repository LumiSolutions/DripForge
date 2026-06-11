"use client"

import { ShopFooter } from "@/components/dripforge/shop-footer"
import { ShopHeader } from "@/components/dripforge/shop-header"
import { SiteTextsProvider } from "@/components/dripforge/site-texts-provider"

export default function KontoLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteTextsProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <ShopHeader mode="link" />
        <div className="flex-1 py-12 md:py-14">{children}</div>
        <ShopFooter />
      </div>
    </SiteTextsProvider>
  )
}
