"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { cmsReadonlyPreviewHref } from "@/lib/admin/cms-preview-pages"
import {
  mergeCmsPages,
  resolveCmsEditorPages,
  type CmsPageEntry,
} from "@/lib/admin/site-nav"
import { cn } from "@/lib/utils"

/**
 * Reine Staging-Vorschau ohne Edit-Overlays — für Tester und Admins.
 */
export function AdminTestStagingPreview() {
  const [pages, setPages] = useState<CmsPageEntry[]>(mergeCmsPages(null))
  const [selectedPath, setSelectedPath] = useState("/")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [iframeKey, setIframeKey] = useState(0)

  const previewPages = useMemo(() => resolveCmsEditorPages(pages), [pages])
  const iframeSrc = useMemo(
    () => cmsReadonlyPreviewHref(selectedPath),
    [selectedPath]
  )

  const loadPages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/preview/site-config", {
        cache: "no-store",
        credentials: "include",
      })
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          "Anmeldung als Admin oder Tester erforderlich für die Staging-Vorschau."
        )
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      const nextPages = mergeCmsPages(data.pages)
      setPages(nextPages)
      const all = resolveCmsEditorPages(nextPages)
      setSelectedPath((current) => {
        if (all.some((page) => page.path === current)) return current
        return all[0]?.path ?? "/"
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Vorschau konnte nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPages()
  }, [loadPages])

  const selectPage = (path: string) => {
    setSelectedPath(path)
    setIframeKey((k) => k + 1)
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-16", adminUi.muted)}>
        <Loader2 className="h-5 w-5 animate-spin" />
        Test-Vorschau wird geladen…
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <Eye className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className={cn("text-xl font-bold", adminUi.heading)}>Test-Vorschau</h1>
        <p className={cn("text-sm", adminUi.muted)}>{error}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => void loadPages()}>
            Erneut versuchen
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={adminPortalPath("/test")}>Zur Test-Umgebung</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-2 flex h-[calc(100dvh-6rem)] flex-col gap-3 sm:-mx-0">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 shadow-sm">
        <Button type="button" size="sm" variant="ghost" asChild>
          <Link href={adminPortalPath("/test")}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Test-Umgebung
          </Link>
        </Button>

        <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
          <Eye className="h-4 w-4" />
          Staging-Test (nur lesen) — keine Bearbeitungswerkzeuge
        </div>

        <label className="flex min-w-[12rem] flex-1 items-center gap-2 text-sm sm:max-w-xs">
          <span className={cn("shrink-0 text-xs font-medium uppercase", adminUi.muted)}>
            Seite
          </span>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={selectedPath}
            onChange={(e) => selectPage(e.target.value)}
          >
            {previewPages.map((page) => (
              <option key={page.id} value={page.path}>
                {page.title}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href={iframeSrc} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Vollbild / neues Fenster
            </Link>
          </Button>
          <Button type="button" size="sm" variant="secondary" asChild>
            <Link href={adminPortalPath("/edit/preview")}>Zum Editor</Link>
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-background shadow-inner">
        <iframe
          key={`${iframeKey}:${iframeSrc}`}
          title="Staging Test Preview"
          src={iframeSrc}
          className="h-full w-full border-0 bg-background"
        />
      </div>
    </div>
  )
}
