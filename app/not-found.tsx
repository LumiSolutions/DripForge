"use client"

import { SafeLink } from "@/components/dripforge/safe-link"
import { hardNavigate } from "@/lib/dripforge/safe-navigate"

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Seite nicht gefunden</h1>
      <p className="text-sm text-muted-foreground">
        Diese Adresse existiert nicht oder ist nicht mehr verfügbar.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <SafeLink
          href="/"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Zur Startseite
        </SafeLink>
        <button
          type="button"
          onClick={() => hardNavigate("/shop")}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
        >
          Zum Shop
        </button>
      </div>
    </div>
  )
}
