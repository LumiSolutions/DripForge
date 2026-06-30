"use client"

import { useEffect, Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { ShopHeader } from "@/components/dripforge/shop-header"
import { ShopFooter } from "@/components/dripforge/shop-footer"
import { SupportPageContent } from "@/components/dripforge/views/support-page-content"
import { fetchSupportPageSettings } from "@/hooks/use-support-page-active"

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

function SupportPageGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "allowed" | "blocked">("loading")

  useEffect(() => {
    let cancelled = false

    void fetchSupportPageSettings()
      .then((settings) => {
        if (cancelled) return
        if (!settings.showSupportOnMainSite) {
          setStatus("blocked")
          router.replace("/")
          return
        }
        setStatus("allowed")
      })
      .catch(() => {
        if (cancelled) return
        // API-Fehler: Seite anzeigen (Middleware hat bereits geprüft)
        setStatus("allowed")
      })

    return () => {
      cancelled = true
    }
  }, [router])

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Wird geladen…
      </div>
    )
  }

  if (status === "blocked") {
    return null
  }

  return <>{children}</>
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
    <div className="min-h-screen bg-background text-foreground">
      <ShopHeader mode="link" />

      <main>
        <SupportPageGate>
          <Suspense
            fallback={
              <div className="py-24 text-center text-muted-foreground">
                Support-Seite wird geladen…
              </div>
            }
          >
            <SupportPageInner />
          </Suspense>
        </SupportPageGate>
      </main>

      <ShopFooter />
    </div>
  )
}
