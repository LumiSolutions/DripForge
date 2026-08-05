"use client"

import { useEffect } from "react"
import { hardNavigate } from "@/lib/dripforge/safe-navigate"

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Storefront error:", error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">Seite konnte nicht geladen werden</h1>
      <p className="text-sm text-muted-foreground">
        Besonders in In-App-Browsern (z.&nbsp;B. Instagram) kann die Seite
        hängen. Bitte neu laden oder eine andere Seite öffnen.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Erneut versuchen
        </button>
        <button
          type="button"
          onClick={() => hardNavigate("/shop")}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
        >
          Zum Shop
        </button>
        <button
          type="button"
          onClick={() => hardNavigate("/")}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
        >
          Startseite
        </button>
      </div>
    </div>
  )
}
