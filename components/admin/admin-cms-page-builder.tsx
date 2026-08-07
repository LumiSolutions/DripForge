"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  CMS_PAGE_BLOCK_TYPES,
  createEmptyCmsPageBlock,
  customPagePathFromSlug,
  slugifyCmsPathSegment,
  type CmsPageBlock,
  type CmsPageBlockType,
} from "@/lib/admin/cms-custom-pages"
import {
  mergeCmsPages,
  type CmsPageEntry,
} from "@/lib/admin/site-nav"
import { cn } from "@/lib/utils"

const BLOCK_LABELS: Record<CmsPageBlockType, string> = {
  richtext: "Text (Rich-Text)",
  imageText: "Bild + Text",
  gallery: "Bilder-Galerie",
  faq: "FAQ-Akkordeon",
  contact: "Kontaktformular",
}

function reorderBlocks(blocks: CmsPageBlock[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= blocks.length) return blocks
  const next = [...blocks]
  const tmp = next[index]
  next[index] = next[target]
  next[target] = tmp
  return next.map((block, i) => ({ ...block, sortOrder: i }))
}

export function AdminCmsPageBuilder() {
  const [pages, setPages] = useState<CmsPageEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [addBlockType, setAddBlockType] = useState<CmsPageBlockType>("richtext")

  const customPages = useMemo(
    () => pages.filter((page) => !page.system),
    [pages]
  )
  const selected =
    customPages.find((page) => page.id === selectedId) ?? customPages[0] ?? null

  useEffect(() => {
    let cancelled = false
    void fetch("/api/admin/site-config", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Seiten konnten nicht geladen werden.")
        if (cancelled) return
        const next = mergeCmsPages(data.pages)
        setPages(next)
        const firstCustom = next.find((page) => !page.system)
        setSelectedId(firstCustom?.id ?? null)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Seiten konnten nicht geladen werden."
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const updateSelected = (patch: Partial<CmsPageEntry>) => {
    if (!selected) return
    setPages((prev) =>
      prev.map((page) => {
        if (page.id !== selected.id) return page
        const next = { ...page, ...patch }
        if (patch.slug != null || patch.title != null) {
          const slug = slugifyCmsPathSegment(
            patch.slug ?? next.slug ?? next.title ?? "seite"
          )
          next.slug = slug
          next.path = customPagePathFromSlug(slug)
        }
        return next
      })
    )
  }

  const updateBlocks = (blocks: CmsPageBlock[]) => {
    updateSelected({
      blocks: blocks.map((block, index) => ({ ...block, sortOrder: index })),
    })
  }

  const addCustomPage = () => {
    const slug = `seite-${Date.now().toString(36)}`
    const id = `custom-${Date.now()}`
    const page: CmsPageEntry = {
      id,
      title: "Neue Seite",
      path: customPagePathFromSlug(slug),
      enabled: true,
      sortOrder: pages.length,
      system: false,
      slug,
      published: false,
      heroTitle: "Neue Seite",
      heroSubtitle: "",
      bannerImageUrl: null,
      blocks: [createEmptyCmsPageBlock("richtext")],
    }
    setPages((prev) => [...prev, page])
    setSelectedId(id)
  }

  const savePages = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/site-config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: mergeCmsPages(pages) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen.")
      setPages(mergeCmsPages(data.pages ?? pages))
      setSuccess(
        "Staging gespeichert. Zum Live-Schalten unter «Website bearbeiten» publizieren."
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Seiten werden geladen…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={cn("text-2xl font-bold", adminUi.heading)}>
            Seiten-Builder
          </h1>
          <p className={cn("mt-1 text-sm", adminUi.muted)}>
            Custom-Unterseiten mit Blöcken erstellen. Öffentliche URL:{" "}
            <code className="rounded bg-muted px-1">/seiten/[slug]</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addCustomPage}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Seite
          </Button>
          <Button type="button" onClick={() => void savePages()} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Speichern
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card className={adminUi.card}>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Custom-Seiten
            </p>
            {customPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Custom-Seiten. Erstellen Sie die erste Seite.
              </p>
            ) : (
              <ul className="space-y-1">
                {customPages.map((page) => (
                  <li key={page.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(page.id)}
                      className={cn(
                        "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        selected?.id === page.id
                          ? "bg-primary/15 text-foreground"
                          : "hover:bg-muted/60 text-muted-foreground"
                      )}
                    >
                      <span className="block font-medium text-foreground">
                        {page.title}
                      </span>
                      <span className="block text-xs">
                        {page.published ? "Veröffentlicht" : "Entwurf"} ·{" "}
                        {page.path}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {selected ? (
          <div className="space-y-4">
            <Card className={adminUi.card}>
              <CardContent className="space-y-4 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Titel</Label>
                    <Input
                      value={selected.title}
                      onChange={(e) =>
                        updateSelected({
                          title: e.target.value,
                          heroTitle: selected.heroTitle || e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Slug</Label>
                    <Input
                      value={selected.slug ?? ""}
                      onChange={(e) => updateSelected({ slug: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">{selected.path}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={selected.published === true}
                      onCheckedChange={(checked) =>
                        updateSelected({ published: checked, enabled: true })
                      }
                    />
                    Veröffentlicht
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={selected.enabled !== false}
                      onCheckedChange={(checked) =>
                        updateSelected({ enabled: checked })
                      }
                    />
                    In Listen aktiv
                  </label>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`${selected.path}${
                        selected.published ? "" : "?preview=1"
                      }`}
                      target="_blank"
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Vorschau
                    </Link>
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Hero-Titel</Label>
                    <Input
                      value={selected.heroTitle ?? ""}
                      onChange={(e) =>
                        updateSelected({ heroTitle: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Banner-Bild URL</Label>
                    <Input
                      value={selected.bannerImageUrl ?? ""}
                      onChange={(e) =>
                        updateSelected({
                          bannerImageUrl: e.target.value.trim() || null,
                        })
                      }
                      placeholder="https://… oder /uploads/…"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Hero-Untertitel</Label>
                  <Textarea
                    value={selected.heroSubtitle ?? ""}
                    onChange={(e) =>
                      updateSelected({ heroSubtitle: e.target.value })
                    }
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className={adminUi.card}>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className={cn("text-base font-semibold", adminUi.heading)}>
                    Inhalts-Blöcke
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={addBlockType}
                      onValueChange={(value) =>
                        setAddBlockType(value as CmsPageBlockType)
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CMS_PAGE_BLOCK_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {BLOCK_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateBlocks([
                          ...(selected.blocks ?? []),
                          createEmptyCmsPageBlock(addBlockType),
                        ])
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Block
                    </Button>
                  </div>
                </div>

                {(selected.blocks ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Noch keine Blöcke. Fügen Sie Text, Galerie, FAQ oder Kontakt hinzu.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {(selected.blocks ?? []).map((block, index) => (
                      <li
                        key={block.id}
                        className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {BLOCK_LABELS[block.type]}
                          </p>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={index === 0}
                              onClick={() =>
                                updateBlocks(
                                  reorderBlocks(selected.blocks ?? [], index, -1)
                                )
                              }
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={
                                index === (selected.blocks ?? []).length - 1
                              }
                              onClick={() =>
                                updateBlocks(
                                  reorderBlocks(selected.blocks ?? [], index, 1)
                                )
                              }
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                updateBlocks(
                                  (selected.blocks ?? []).filter(
                                    (entry) => entry.id !== block.id
                                  )
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>

                        {block.type === "richtext" ? (
                          <Textarea
                            rows={6}
                            value={block.html ?? ""}
                            onChange={(e) => {
                              const next = [...(selected.blocks ?? [])]
                              next[index] = { ...block, html: e.target.value }
                              updateBlocks(next)
                            }}
                            placeholder="<h2>Überschrift</h2><p>Text…</p><ul><li>Punkt</li></ul>"
                          />
                        ) : null}

                        {block.type === "imageText" ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label>Bild-URL</Label>
                              <Input
                                value={block.imageUrl ?? ""}
                                onChange={(e) => {
                                  const next = [...(selected.blocks ?? [])]
                                  next[index] = {
                                    ...block,
                                    imageUrl: e.target.value.trim() || null,
                                  }
                                  updateBlocks(next)
                                }}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Bildposition</Label>
                              <Select
                                value={block.imagePosition ?? "left"}
                                onValueChange={(value) => {
                                  const next = [...(selected.blocks ?? [])]
                                  next[index] = {
                                    ...block,
                                    imagePosition:
                                      value === "right" ? "right" : "left",
                                  }
                                  updateBlocks(next)
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="left">Bild links</SelectItem>
                                  <SelectItem value="right">Bild rechts</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                              <Label>Text (HTML)</Label>
                              <Textarea
                                rows={5}
                                value={block.textHtml ?? ""}
                                onChange={(e) => {
                                  const next = [...(selected.blocks ?? [])]
                                  next[index] = {
                                    ...block,
                                    textHtml: e.target.value,
                                  }
                                  updateBlocks(next)
                                }}
                              />
                            </div>
                          </div>
                        ) : null}

                        {block.type === "gallery" ? (
                          <div className="space-y-1.5">
                            <Label>Bild-URLs (eine pro Zeile)</Label>
                            <Textarea
                              rows={4}
                              value={(block.images ?? []).join("\n")}
                              onChange={(e) => {
                                const images = e.target.value
                                  .split("\n")
                                  .map((line) => line.trim())
                                  .filter(Boolean)
                                const next = [...(selected.blocks ?? [])]
                                next[index] = { ...block, images }
                                updateBlocks(next)
                              }}
                            />
                          </div>
                        ) : null}

                        {block.type === "faq" ? (
                          <div className="space-y-3">
                            {(block.faqItems ?? []).map((item, faqIndex) => (
                              <div
                                key={item.id}
                                className="space-y-2 rounded-lg border border-border/50 p-3"
                              >
                                <Input
                                  value={item.question}
                                  placeholder="Frage"
                                  onChange={(e) => {
                                    const faqItems = [...(block.faqItems ?? [])]
                                    faqItems[faqIndex] = {
                                      ...item,
                                      question: e.target.value,
                                    }
                                    const next = [...(selected.blocks ?? [])]
                                    next[index] = { ...block, faqItems }
                                    updateBlocks(next)
                                  }}
                                />
                                <Textarea
                                  rows={2}
                                  value={item.answer}
                                  placeholder="Antwort"
                                  onChange={(e) => {
                                    const faqItems = [...(block.faqItems ?? [])]
                                    faqItems[faqIndex] = {
                                      ...item,
                                      answer: e.target.value,
                                    }
                                    const next = [...(selected.blocks ?? [])]
                                    next[index] = { ...block, faqItems }
                                    updateBlocks(next)
                                  }}
                                />
                              </div>
                            ))}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const faqItems = [
                                  ...(block.faqItems ?? []),
                                  {
                                    id: `faq-${Date.now()}`,
                                    question: "Neue Frage",
                                    answer: "",
                                  },
                                ]
                                const next = [...(selected.blocks ?? [])]
                                next[index] = { ...block, faqItems }
                                updateBlocks(next)
                              }}
                            >
                              FAQ-Eintrag
                            </Button>
                          </div>
                        ) : null}

                        {block.type === "contact" ? (
                          <p className="text-sm text-muted-foreground">
                            Rendert das Standard-Kontaktformular der Storefront.
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className={adminUi.card}>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Keine Custom-Seite ausgewählt.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
