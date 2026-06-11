"use client"

import { useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2016.%20Mai%202026%2C%2022_19_51-CjFqSwPCG95cJ4BMP2Ono6hKObBX8y.png"
              alt="DripForge Logo"
              width={32}
              height={32}
              className="rounded"
            />
            <span className="text-xl font-bold">
              <span className="text-primary">Drip</span>
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                Forge
              </span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Zurück zur Startseite
          </Link>
        </div>
      </header>

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

      <footer className="border-t border-border bg-card/50 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <p>© 2026 DripForge. Alle Rechte vorbehalten.</p>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-primary">
              Startseite
            </Link>
            <span className="text-foreground">Support our Journey</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
