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
import {
  ChevronDown,
  ChevronUp,
  EyeOff,
  Loader2,
  Pencil,
  Rocket,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import {
  disableSiteConfigPreviewInSession,
  disableSiteConfigReadonlyInSession,
  isSiteConfigPreviewEnabled,
  SITE_CONFIG_PREVIEW_PARAM,
  SITE_CONFIG_READONLY_PARAM,
} from "@/lib/admin/site-config"
import { cmsPreviewHref, cmsReadonlyPreviewHref } from "@/lib/admin/cms-preview-pages"
import { resolveCmsEditorPages } from "@/lib/admin/site-nav"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { cn } from "@/lib/utils"

const BANNER_COLLAPSED_KEY = "dripforge_staging_banner_collapsed"

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
    disableSiteConfigReadonlyInSession()
    setPreview(false)
    const url = new URL(window.location.href)
    url.searchParams.delete(SITE_CONFIG_PREVIEW_PARAM)
    url.searchParams.delete(SITE_CONFIG_READONLY_PARAM)
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
  const { canInlineEdit, readonly, refresh, pages } = useSiteTexts()
  const pathname = usePathname() ?? "/"
  const [publishing, setPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const previewPages = useMemo(() => resolveCmsEditorPages(pages), [pages])

  useEffect(() => {
    try {
      setCollapsed(sessionStorage.getItem(BANNER_COLLAPSED_KEY) === "1")
    } catch {
      setCollapsed(false)
    }
  }, [])

  const setCollapsedPreference = (next: boolean) => {
    setCollapsed(next)
    try {
      sessionStorage.setItem(BANNER_COLLAPSED_KEY, next ? "1" : "0")
    } catch {
      /* ignore */
    }
  }

  const publishLive = async () => {
    if (
      !window.confirm(
        "Staging-Inhalte (Texte & Bilder) wirklich live veröffentlichen? Besucher sehen danach sofort diese Version."
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
      const data = (await res.json().catch(() => null)) as {
        error?: string
        message?: string
      } | null
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

  if (collapsed) {
    return (
      <div className="pointer-events-none fixed top-20 left-4 z-[300]">
        <button
          type="button"
          onClick={() => setCollapsedPreference(false)}
          className={cn(
            "pointer-events-auto inline-flex items-center gap-2 rounded-full",
            "border border-amber-500/50 bg-amber-500 px-3 py-2 text-xs font-semibold text-amber-950",
            "shadow-lg backdrop-blur-sm transition hover:bg-amber-400"
          )}
          aria-expanded={false}
          aria-label="Staging-Banner erweitern"
        >
          <span className="h-2 w-2 rounded-full bg-amber-950/80" />
          {readonly ? "Test" : "Staging"}
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[300] flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex max-w-5xl flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/95 px-4 py-2 text-sm font-medium text-amber-950 shadow-lg backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span>
            {readonly
              ? "Test-Vorschau (nur lesen) — Staging-Inhalte wie für Endnutzer, ohne Bearbeitungswerkzeuge."
              : "Staging-Vorschau — Besucher sehen diese Texte und Bilder noch nicht."}
          </span>
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
              Live veröffentlichen
            </Button>
          )}
          {!readonly && (
            <Button type="button" size="sm" variant="secondary" className="h-8" asChild>
              <Link href={adminPortalPath("/edit")}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Zum CMS
              </Link>
            </Button>
          )}
          <Button type="button" size="sm" variant="secondary" className="h-8" onClick={exitPreview}>
            <EyeOff className="mr-1 h-3.5 w-3.5" />
            Vorschau beenden
          </Button>
          <button
            type="button"
            onClick={() => setCollapsedPreference(true)}
            className="rounded-md p-1 text-amber-950/70 hover:bg-amber-600/30 hover:text-amber-950"
            aria-label="Banner minimieren"
            title="Minimieren"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={exitPreview}
            className="rounded-md p-1 text-amber-950/70 hover:bg-amber-600/30 hover:text-amber-950"
            aria-label="Vorschau schliessen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-amber-700/20 pt-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-amber-950/70">
            Seite
          </span>
          {previewPages.map((page) => {
            const active =
              page.path === "/"
                ? pathname === "/"
                : pathname === page.path || pathname.startsWith(`${page.path}/`)
            const href = readonly
              ? cmsReadonlyPreviewHref(page.path)
              : cmsPreviewHref(page.path)
            return (
              <Link
                key={page.id}
                href={href}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition",
                  active
                    ? "bg-amber-950 text-amber-50"
                    : "bg-amber-600/25 text-amber-950 hover:bg-amber-600/40"
                )}
              >
                {page.title}
              </Link>
            )
          })}
        </div>

        {publishMessage && (
          <span className="w-full text-center text-xs font-semibold">{publishMessage}</span>
        )}
      </div>
    </div>
  )
}
