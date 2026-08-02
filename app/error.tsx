"use client"

import { useEffect } from "react"
import { hardNavigate } from "@/lib/dripforge/safe-navigate"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("App error boundary:", error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Etwas ist schiefgelaufen</h1>
      <p className="text-sm text-muted-foreground">
        Die Seite konnte nicht geladen werden. Bitte erneut versuchen oder zur
        Startseite wechseln.
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
          onClick={() => hardNavigate("/")}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
        >
          Zur Startseite
        </button>
      </div>
    </div>
  )
}
