"use client"

import { useEffect, type ReactNode } from "react"
import { SafeLink } from "@/components/dripforge/safe-link"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { SiteImage } from "@/components/dripforge/editable-site-image"
import { cn } from "@/lib/utils"

export function LegalSubpageLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("theme") as
        | "light"
        | "dark"
        | null
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      const theme = savedTheme ?? (prefersDark ? "dark" : "light")
      document.documentElement.classList.toggle("dark", theme === "dark")
    } catch {
      /* Incognito / In-App: Storage blockiert */
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-[100]",
          "border-b border-border/60 bg-background/95 shadow-sm backdrop-blur-md",
          "supports-[backdrop-filter]:bg-background/90"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <SafeLink href="/" className="flex items-center gap-2">
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
          </SafeLink>
          <SafeLink
            href="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <SiteText k="legal_subpage_back" />
          </SafeLink>
        </div>
      </header>
      <div className="h-16 shrink-0" aria-hidden="true" />

      <main className="mx-auto max-w-7xl">{children}</main>
    </div>
  )
}
