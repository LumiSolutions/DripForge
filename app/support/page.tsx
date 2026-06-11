"use client"

import { useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ShopHeader } from "@/components/dripforge/shop-header"
import { ShopFooter } from "@/components/dripforge/shop-footer"
import { SiteTextsProvider } from "@/components/dripforge/site-texts-provider"
import { SupportPageContent } from "@/components/dripforge/views/support-page-content"

function SupportPageInner() {
  const searchParams = useSearchParams()
  const initialSuccess = searchParams.get("success") === "1"
  const initialCanceled = searchParams.get("canceled") === "1"

  return (
    <SupportPageContent
      initialSuccess={initialSuccess}
      initialCanceled={initialCanceled}
    />
  )
}

export default function SupportPage() {
  useEffect(() => {
    document.documentElement.classList.add("dark")
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    if (savedTheme === "light") {
      document.documentElement.classList.remove("dark")
    }
  }, [])

  return (
    <SiteTextsProvider>
      <div className="min-h-screen bg-background text-foreground">
        <ShopHeader mode="link" />

        <main>
          <Suspense
            fallback={
              <div className="py-24 text-center text-muted-foreground">
                Support-Seite wird geladen…
              </div>
            }
          >
            <SupportPageInner />
          </Suspense>
        </main>

        <ShopFooter />
      </div>
    </SiteTextsProvider>
  )
}
