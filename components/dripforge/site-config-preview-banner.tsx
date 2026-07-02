"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { EyeOff, Loader2, Rocket, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import {
  disableSiteConfigPreviewInSession,
  isSiteConfigPreviewEnabled,
  SITE_CONFIG_PREVIEW_PARAM,
} from "@/lib/admin/site-config"

type SiteConfigPreviewContextValue = {
  preview: boolean
  exitPreview: () => void
}

const SiteConfigPreviewContext = createContext<SiteConfigPreviewContextValue>({
  preview: false,
  exitPreview: () => {},
})

export function useSiteConfigPreview(): boolean {
  return useContext(SiteConfigPreviewContext).preview
}

export function SiteConfigPreviewProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    setPreview(isSiteConfigPreviewEnabled(window.location.search))
  }, [pathname])

  const exitPreview = useCallback(() => {
    disableSiteConfigPreviewInSession()
    setPreview(false)
    const url = new URL(window.location.href)
    url.searchParams.delete(SITE_CONFIG_PREVIEW_PARAM)
    window.location.href = url.toString()
  }, [])

  const value = useMemo(
    () => ({ preview, exitPreview }),
    [preview, exitPreview]
  )

  return (
    <SiteConfigPreviewContext.Provider value={value}>
      {children}
    </SiteConfigPreviewContext.Provider>
  )
}

export function SiteConfigPreviewBanner() {
  const { preview, exitPreview } = useContext(SiteConfigPreviewContext)
  const { canInlineEdit, refresh } = useSiteTexts()
  const [publishing, setPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState<string | null>(null)

  const publishLive = async () => {
    if (
      !window.confirm(
        "Staging-Texte wirklich live veröffentlichen? Besucher sehen danach sofort diese Version."
      )
    ) {
      return
    }

    setPublishing(true)
    setPublishMessage(null)
    try {
      const res = await fetch("/api/admin/site-config/publish", {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
      if (!res.ok) {
        throw new Error(data?.error ?? "Veröffentlichen fehlgeschlagen")
      }
      setPublishMessage("Live veröffentlicht.")
      await refresh()
    } catch (err) {
      setPublishMessage(
        err instanceof Error ? err.message : "Veröffentlichen fehlgeschlagen"
      )
    } finally {
      setPublishing(false)
    }
  }

  if (!preview) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[300] flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex max-w-4xl flex-wrap items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/95 px-4 py-2 text-sm font-medium text-amber-950 shadow-lg backdrop-blur-sm">
        <span>Staging-Vorschau — Besucher sehen diese Texte noch nicht.</span>
        {canInlineEdit && (
          <Button
            type="button"
            size="sm"
            disabled={publishing}
            className="h-8 bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={() => void publishLive()}
          >
            {publishing ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="mr-1 h-3.5 w-3.5" />
            )}
            Änderungen live veröffentlichen
          </Button>
        )}
        <Button type="button" size="sm" variant="secondary" className="h-8" asChild>
          <Link href="/admin/content">Zum CMS</Link>
        </Button>
        <Button type="button" size="sm" variant="secondary" className="h-8" onClick={exitPreview}>
          <EyeOff className="mr-1 h-3.5 w-3.5" />
          Vorschau beenden
        </Button>
        <button
          type="button"
          onClick={exitPreview}
          className="rounded-md p-1 text-amber-950/70 hover:bg-amber-600/30 hover:text-amber-950"
          aria-label="Vorschau schliessen"
        >
          <X className="h-4 w-4" />
        </button>
        {publishMessage && (
          <span className="w-full text-center text-xs font-semibold">{publishMessage}</span>
        )}
      </div>
    </div>
  )
}
