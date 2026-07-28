"use client"

import { useEffect, type ReactNode } from "react"
import Link from "next/link"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { SiteImage } from "@/components/dripforge/editable-site-image"

export function LegalSubpageLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const theme = savedTheme ?? (prefersDark ? "dark" : "light")
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <SiteImage
              imageKey="brand_logo"
              width={32}
              height={32}
              imageClassName="rounded"
              className="shrink-0"
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
            <SiteText k="legal_subpage_back" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl">{children}</main>
    </div>
  )
}
