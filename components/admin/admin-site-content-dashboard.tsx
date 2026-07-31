"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Eye,
  Loader2,
  MousePointerClick,
  Rocket,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { cmsPreviewHref } from "@/lib/admin/cms-preview-pages"
import {
  mergeCmsNavItems,
  mergeCmsPages,
  resolveVisibleCmsPages,
  type CmsNavItem,
  type CmsPageEntry,
} from "@/lib/admin/site-nav"
import { mergeSiteLinks, type SiteLinks } from "@/lib/admin/site-links"
import { mergeSiteTexts, type SiteTexts } from "@/lib/admin/site-texts"
import { AdminCmsPagesNavPanel } from "@/components/admin/admin-cms-pages-nav-panel"
import { cn } from "@/lib/utils"

type SiteConfigMeta = {
  stagingUpdatedAt: string | null
  productionUpdatedAt: string | null
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat("de-CH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function AdminSiteContentDashboard() {
  const [texts, setTexts] = useState<SiteTexts>(mergeSiteTexts(null))
  const [links, setLinks] = useState<SiteLinks>(mergeSiteLinks(null))
  const [navItems, setNavItems] = useState<CmsNavItem[]>(mergeCmsNavItems(null))
  const [pages, setPages] = useState<CmsPageEntry[]>(mergeCmsPages(null))
  const [meta, setMeta] = useState<SiteConfigMeta>({
    stagingUpdatedAt: null,
    productionUpdatedAt: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const previewPages = useMemo(() => resolveVisibleCmsPages(pages), [pages])

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/site-config", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setTexts(mergeSiteTexts(data.texts))
      setLinks(mergeSiteLinks(data.links))
      setNavItems(mergeCmsNavItems(data.navItems))
      setPages(mergeCmsPages(data.pages))
      if (data.meta) setMeta(data.meta)
    } catch (err) {
      console.warn("Admin: Site-Config konnte nicht geladen werden.", err)
      setError(
        err instanceof Error ? err.message : "Texte konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const saveConfig = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/site-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ texts, links, navItems, pages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setTexts(mergeSiteTexts(data.texts))
      setLinks(mergeSiteLinks(data.links))
      setNavItems(mergeCmsNavItems(data.navItems))
      setPages(mergeCmsPages(data.pages))
      if (data.meta) setMeta(data.meta)
      setSuccess(
        "Gespeichert (Staging) — noch nicht live. In-Context Editor testen oder veröffentlichen."
      )
    } catch (err) {
      console.warn("Admin: Site-Config konnte nicht gespeichert werden.", err)
      setError(
        err instanceof Error ? err.message : "Texte konnten nicht gespeichert werden."
      )
    } finally {
      setSaving(false)
    }
  }

  const publishConfig = async () => {
    if (
      !window.confirm(
        "Staging-Inhalte wirklich live veröffentlichen? Besucher sehen danach sofort die Entwurfsversion."
      )
    ) {
      return
    }

    setPublishing(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/site-config/publish", {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Veröffentlichen fehlgeschlagen")
      if (data.meta) setMeta(data.meta)
      setSuccess("Änderungen sind jetzt live (Production).")
    } catch (err) {
      console.warn("Admin: Site-Config konnte nicht veröffentlicht werden.", err)
      setError(
        err instanceof Error ? err.message : "Texte konnten nicht veröffentlicht werden."
      )
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-16", adminUi.muted)}>
        <Loader2 className="h-5 w-5 animate-spin" />
        Website-Inhalte werden geladen…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className={cn("text-2xl font-bold", adminUi.heading)}>Website bearbeiten</h1>
        <p className={cn("mt-2 text-sm", adminUi.muted)}>
          Texte und Bilder bearbeitest du direkt auf der Website (In-Context). Änderungen landen
          zuerst in Staging und werden erst nach dem Veröffentlichen live.
        </p>
        <div className={cn("mt-3 flex flex-wrap gap-4 text-xs", adminUi.muted)}>
          <span>Entwurf zuletzt: {formatTimestamp(meta.stagingUpdatedAt)}</span>
          <span>Live zuletzt: {formatTimestamp(meta.productionUpdatedAt)}</span>
        </div>
      </div>

      <Card className={adminUi.card}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={cn("text-base font-semibold", adminUi.heading)}>
              In-Context Editor
            </p>
            <p className={cn("mt-1 text-sm", adminUi.muted)}>
              Öffne die Storefront im Bearbeitungsmodus — klicke Texte und Bilder direkt an.
            </p>
          </div>
          <Button type="button" size="lg" asChild>
            <Link href={adminPortalPath("/edit/preview")}>
              <MousePointerClick className="mr-2 h-4 w-4" />
              In-Context Editor öffnen
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className={adminUi.card}>
        <CardContent className="space-y-3 p-4">
          <p className={cn("text-sm font-medium", adminUi.heading)}>Seiten-Navigation (Vorschau)</p>
          <div className="flex flex-wrap gap-2">
            {previewPages.map((page) => (
              <Button key={page.id} type="button" size="sm" variant="outline" asChild>
                <Link
                  href={cmsPreviewHref(page.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {page.title}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            onClick={() => void saveConfig()}
            disabled={saving || publishing}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Speichern
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => void publishConfig()}
            disabled={publishing || saving}
            className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
          >
            {publishing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-2 h-4 w-4" />
            )}
            Live veröffentlichen
          </Button>
        </div>
        <Button type="button" size="lg" variant="secondary" asChild>
          <Link
            href={cmsPreviewHref("/")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Eye className="mr-2 h-4 w-4" />
            Staging-Vorschau öffnen
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {success}
        </div>
      )}

      <Card className={adminUi.card}>
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className={cn("text-lg font-semibold", adminUi.heading)}>
              Seiten & Navigation verwalten
            </h2>
            <p className={cn("mt-1 text-sm", adminUi.muted)}>
              Seiten für den Editor hinzufügen, Navigation sortieren, Icons wählen und Einträge
              aktivieren oder deaktivieren. Mit «Speichern» in Staging schreiben.
            </p>
          </div>
          <AdminCmsPagesNavPanel
            pages={pages}
            navItems={navItems}
            onPagesChange={setPages}
            onNavItemsChange={setNavItems}
            disabled={saving || publishing}
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void publishConfig()}
          disabled={saving || publishing}
          className="shadow-lg"
        >
          {publishing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="mr-2 h-4 w-4" />
          )}
          Live veröffentlichen
        </Button>
        <Button
          type="button"
          onClick={() => void saveConfig()}
          disabled={saving || publishing}
          className="shadow-lg"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Speichern
        </Button>
      </div>
    </div>
  )
}
