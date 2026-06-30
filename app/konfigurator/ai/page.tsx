"use client"

import { useEffect } from "react"
import { ShopHeader } from "@/components/dripforge/shop-header"
import { ShopFooter } from "@/components/dripforge/shop-footer"
import { PageAiConfigurator } from "@/components/dripforge/views/page-ai-configurator"

export default function AiConfiguratorPage() {
  useEffect(() => {
    document.documentElement.classList.add("dark")
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ShopHeader mode="link" />
      <main>
        <PageAiConfigurator />
      </main>
      <ShopFooter />
    </div>
  )
}
