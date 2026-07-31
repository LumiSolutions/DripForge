"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Eye, Loader2, Rocket, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { SITE_CONFIG_PREVIEW_PARAM } from "@/lib/admin/site-config"
import {
  CMS_PREVIEW_PAGES,
  cmsPreviewHref,
} from "@/lib/admin/cms-preview-pages"
import {
  getDefaultSiteLinkHref,
  mergeSiteLinks,
  type SiteLinks,
} from "@/lib/admin/site-links"
import {
  getSiteTextFieldMeta,
  mergeSiteTexts,
  SITE_TEXT_SECTIONS,
  type SiteTextKey,
  type SiteTexts,
} from "@/lib/admin/site-texts"
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
  const [meta, setMeta] = useState<SiteConfigMeta>({
    stagingUpdatedAt: null,
    productionUpdatedAt: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadTexts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/site-config", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setTexts(mergeSiteTexts(data.texts))
      setLinks(mergeSiteLinks(data.links))
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
    void loadTexts()
  }, [loadTexts])

  const updateField = (key: SiteTextKey, value: string) => {
    setTexts((prev) => ({ ...prev, [key]: value }))
  }

  const updateLink = (key: string, href: string) => {
    setLinks((prev) => ({ ...prev, [key]: { href } }))
  }

  const saveTexts = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/site-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ texts, links }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setTexts(mergeSiteTexts(data.texts))
      setLinks(mergeSiteLinks(data.links))
      if (data.meta) setMeta(data.meta)
      setSuccess("Gespeichert (Staging) — noch nicht live. Vorschau testen oder veröffentlichen.")
    } catch (err) {
      console.warn("Admin: Site-Config konnte nicht gespeichert werden.", err)
      setError(
        err instanceof Error ? err.message : "Texte konnten nicht gespeichert werden."
      )
    } finally {
      setSaving(false)
    }
  }

  const publishTexts = async () => {
    if (
      !window.confirm(
        "Staging-Texte wirklich live veröffentlichen? Besucher sehen danach sofort die Entwurfsversion."
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
        Texte werden geladen…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className={cn("text-2xl font-bold", adminUi.heading)}>Website bearbeiten</h1>
        <p className={cn("mt-2 text-sm", adminUi.muted)}>
          Änderungen werden als Entwurf (Staging) gespeichert. Erst nach dem Veröffentlichen sind
          sie für Besucher sichtbar.
        </p>
        <div className={cn("mt-3 flex flex-wrap gap-4 text-xs", adminUi.muted)}>
          <span>Entwurf zuletzt: {formatTimestamp(meta.stagingUpdatedAt)}</span>
          <span>Live zuletzt: {formatTimestamp(meta.productionUpdatedAt)}</span>
        </div>
      </div>

      <Card className={adminUi.card}>
        <CardContent className="space-y-3 p-4">
          <p className={cn("text-sm font-medium", adminUi.heading)}>Seiten-Navigation (Vorschau)</p>
          <div className="flex flex-wrap gap-2">
            {CMS_PREVIEW_PAGES.map((page) => (
              <Button key={page.id} type="button" size="sm" variant="outline" asChild>
                <Link
                  href={cmsPreviewHref(page.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {page.label}
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
            onClick={() => void saveTexts()}
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
            onClick={() => void publishTexts()}
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
            href={`/?${SITE_CONFIG_PREVIEW_PARAM}=true`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Eye className="mr-2 h-4 w-4" />
            Vorschau öffnen
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

      <Tabs defaultValue="landingpage" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1">
          {SITE_TEXT_SECTIONS.map((section) => (
            <TabsTrigger key={section.id} value={section.id} className="text-xs sm:text-sm">
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {SITE_TEXT_SECTIONS.map((section) => (
          <TabsContent key={section.id} value={section.id}>
            <Card className={adminUi.card}>
              <CardContent className="space-y-5 p-6">
                {section.fields.map((field) => {
                  const metaField = getSiteTextFieldMeta(field.key)
                  const defaultHref = getDefaultSiteLinkHref(field.key) ?? ""
                  return (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <Textarea
                        id={field.key}
                        rows={field.multiline ? 4 : 3}
                        value={texts[field.key]}
                        onChange={(e) => updateField(field.key, e.target.value)}
                      />
                      {metaField.hrefEditable && (
                        <div className="space-y-1">
                          <Label htmlFor={`${field.key}-href`}>Ziel-URL</Label>
                          <Input
                            id={`${field.key}-href`}
                            value={links[field.key]?.href ?? defaultHref}
                            placeholder={defaultHref || "/…"}
                            onChange={(e) => updateLink(field.key, e.target.value)}
                          />
                        </div>
                      )}
                      <p className={cn("text-[11px]", adminUi.muted)}>Schlüssel: {field.key}</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <div className="sticky bottom-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void publishTexts()}
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
          onClick={() => void saveTexts()}
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
