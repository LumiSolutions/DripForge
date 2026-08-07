"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ExternalLink,
  GripVertical,
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
import { AdminMediaUploadButton } from "@/components/admin/admin-media-upload-button"
import { CmsRichTextEditor } from "@/components/admin/cms-rich-text-editor"
import { CmsCustomPageView } from "@/components/dripforge/views/cms-custom-page-view"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  CMS_PAGE_BLOCK_TYPES,
  createEmptyCmsPageBlock,
  createEmptyCmsPageRow,
  groupBlocksByRow,
  isCmsReservedPath,
  normalizeCmsPagePath,
  slugFromCmsPagePath,
  type CmsPageBlock,
  type CmsPageBlockType,
  type CmsPageColumnLayout,
  type CmsPageRow,
} from "@/lib/admin/cms-custom-pages"
import { mergeCmsPages, type CmsPageEntry } from "@/lib/admin/site-nav"
import { cn } from "@/lib/utils"

const BLOCK_LABELS: Record<CmsPageBlockType, string> = {
  richtext: "Text",
  imageText: "Bild + Text",
  gallery: "Galerie",
  faq: "FAQ",
  contact: "Kontakt",
  valueCards: "Value Cards",
  cta: "Call to Action",
}

export function AdminCmsPageBuilder() {
  const [pages, setPages] = useState<CmsPageEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [addBlockType, setAddBlockType] = useState<CmsPageBlockType>("richtext")
  const [dragBlockId, setDragBlockId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)

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
        setSelectedId(next.find((page) => !page.system)?.id ?? null)
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
        if (patch.path != null) {
          const path = normalizeCmsPagePath(patch.path)
          next.path = path
          next.slug = slugFromCmsPagePath(path) ?? next.slug
        }
        return next
      })
    )
  }

  const rows = selected?.rows?.length
    ? selected.rows
    : [{ id: "row-default", layout: "1" as const, sortOrder: 0 }]
  const blocks = selected?.blocks ?? []

  const setRows = (nextRows: CmsPageRow[]) => {
    updateSelected({
      rows: nextRows.map((row, index) => ({ ...row, sortOrder: index })),
    })
  }

  const setBlocks = (nextBlocks: CmsPageBlock[]) => {
    updateSelected({
      blocks: nextBlocks.map((block, index) => ({ ...block, sortOrder: index })),
    })
  }

  const addCustomPage = () => {
    const path = normalizeCmsPagePath(`/seite-${Date.now().toString(36)}`)
    const id = `custom-${Date.now()}`
    const row = createEmptyCmsPageRow("1")
    const page: CmsPageEntry = {
      id,
      title: "Neue Seite",
      path,
      enabled: true,
      sortOrder: pages.length,
      system: false,
      slug: slugFromCmsPagePath(path) ?? "seite",
      published: false,
      heroTitle: "Neue Seite",
      heroSubtitle: "",
      bannerImageUrl: null,
      rows: [row],
      blocks: [createEmptyCmsPageBlock("richtext", row.id, 0)],
    }
    setPages((prev) => [...prev, page])
    setSelectedId(id)
  }

  const savePages = async () => {
    if (selected && isCmsReservedPath(selected.path)) {
      setError(
        `Pfad «${selected.path}» ist reserviert. Bitte einen freien Pfad wählen (z. B. /ueber-uns).`
      )
      return
    }
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
        "Staging gespeichert. Unter «Website bearbeiten» publizieren, damit die Seite live ist."
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.")
    } finally {
      setSaving(false)
    }
  }

  const onDropBlock = (rowId: string, columnIndex: number) => {
    if (!dragBlockId) return
    setBlocks(
      blocks.map((block) =>
        block.id === dragBlockId ? { ...block, rowId, columnIndex } : block
      )
    )
    setDragBlockId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Seiten werden geladen…
      </div>
    )
  }

  const grouped = selected ? groupBlocksByRow(rows, blocks) : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={cn("text-2xl font-bold", adminUi.heading)}>
            Seiten-Builder
          </h1>
          <p className={cn("mt-1 text-sm", adminUi.muted)}>
            Saubere URLs (z.&nbsp;B. <code>/ueber-uns</code>), Uploads, Spalten-Layout und
            Live-Vorschau.
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

      <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
        <Card className={adminUi.card}>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Seiten
            </p>
            {customPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Custom-Seiten.</p>
            ) : (
              <ul className="space-y-1">
                {customPages.map((page) => (
                  <li key={page.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(page.id)}
                      className={cn(
                        "w-full rounded-lg px-3 py-2 text-left text-sm",
                        selected?.id === page.id
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground hover:bg-muted/60"
                      )}
                    >
                      <span className="block font-medium text-foreground">
                        {page.title}
                      </span>
                      <span className="block text-xs">{page.path}</span>
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
                    <Label>URL-Pfad</Label>
                    <Input
                      value={selected.path}
                      onChange={(e) => updateSelected({ path: e.target.value })}
                      placeholder="/ueber-uns oder /kategorie/seite"
                    />
                    <p className="text-xs text-muted-foreground">
                      Live: dripforge.ch{selected.path}
                    </p>
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
                      checked={showPreview}
                      onCheckedChange={setShowPreview}
                    />
                    Live-Vorschau
                  </label>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`${selected.path}${
                        selected.published ? "" : "?preview=1"
                      }`}
                      target="_blank"
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Öffnen
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
                    <Label>Banner-Bild</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminMediaUploadButton
                        onUploaded={(url) =>
                          updateSelected({ bannerImageUrl: url })
                        }
                      />
                      {selected.bannerImageUrl ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateSelected({ bannerImageUrl: null })
                          }
                        >
                          Entfernen
                        </Button>
                      ) : null}
                    </div>
                    {selected.bannerImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selected.bannerImageUrl}
                        alt=""
                        className="mt-2 h-16 rounded-md object-cover"
                      />
                    ) : null}
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
                    Layout & Blöcke
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      onValueChange={(value) => {
                        const row = createEmptyCmsPageRow(
                          value as CmsPageColumnLayout
                        )
                        setRows([...rows, row])
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Zeile hinzufügen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1-spaltig</SelectItem>
                        <SelectItem value="2">2-spaltig 50/50</SelectItem>
                        <SelectItem value="3">3-spaltig</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={addBlockType}
                      onValueChange={(value) =>
                        setAddBlockType(value as CmsPageBlockType)
                      }
                    >
                      <SelectTrigger className="w-[150px]">
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
                      onClick={() => {
                        const rowId = rows[0]?.id ?? "row-default"
                        setBlocks([
                          ...blocks,
                          createEmptyCmsPageBlock(addBlockType, rowId, 0),
                        ])
                      }}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Block
                    </Button>
                  </div>
                </div>

                {grouped.map(({ row, columns }, rowIndex) => (
                  <div
                    key={row.id}
                    className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">
                          Zeile {rowIndex + 1}
                        </p>
                        <Select
                          value={row.layout}
                          onValueChange={(value) => {
                            setRows(
                              rows.map((entry) =>
                                entry.id === row.id
                                  ? {
                                      ...entry,
                                      layout: value as CmsPageColumnLayout,
                                    }
                                  : entry
                              )
                            )
                          }}
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 Spalte</SelectItem>
                            <SelectItem value="2">2 Spalten</SelectItem>
                            <SelectItem value="3">3 Spalten</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={rows.length <= 1}
                        onClick={() => {
                          setRows(rows.filter((entry) => entry.id !== row.id))
                          setBlocks(
                            blocks.filter((block) => block.rowId !== row.id)
                          )
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    <div
                      className={cn(
                        "grid gap-3",
                        row.layout === "2" && "md:grid-cols-2",
                        row.layout === "3" && "md:grid-cols-3"
                      )}
                    >
                      {columns.map((colBlocks, colIndex) => (
                        <div
                          key={`${row.id}-${colIndex}`}
                          className="min-h-[80px] rounded-lg border border-dashed border-border/70 bg-background/60 p-2"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => onDropBlock(row.id, colIndex)}
                        >
                          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            Spalte {colIndex + 1}
                          </p>
                          <div className="space-y-2">
                            {colBlocks.map((block) => (
                              <div
                                key={block.id}
                                draggable
                                onDragStart={() => setDragBlockId(block.id)}
                                className="space-y-2 rounded-lg border border-border/60 bg-card p-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold">
                                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                    {BLOCK_LABELS[block.type]}
                                  </span>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      setBlocks(
                                        blocks.filter((b) => b.id !== block.id)
                                      )
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                  </Button>
                                </div>

                                {block.type === "richtext" ? (
                                  <CmsRichTextEditor
                                    value={block.html ?? ""}
                                    onChange={(html) =>
                                      setBlocks(
                                        blocks.map((b) =>
                                          b.id === block.id ? { ...b, html } : b
                                        )
                                      )
                                    }
                                  />
                                ) : null}

                                {block.type === "imageText" ? (
                                  <div className="space-y-2">
                                    <AdminMediaUploadButton
                                      onUploaded={(url) =>
                                        setBlocks(
                                          blocks.map((b) =>
                                            b.id === block.id
                                              ? { ...b, imageUrl: url }
                                              : b
                                          )
                                        )
                                      }
                                    />
                                    <CmsRichTextEditor
                                      value={block.textHtml ?? ""}
                                      onChange={(textHtml) =>
                                        setBlocks(
                                          blocks.map((b) =>
                                            b.id === block.id
                                              ? { ...b, textHtml }
                                              : b
                                          )
                                        )
                                      }
                                    />
                                  </div>
                                ) : null}

                                {block.type === "gallery" ? (
                                  <div className="space-y-2">
                                    <AdminMediaUploadButton
                                      label="Bild zur Galerie"
                                      onUploaded={(url) =>
                                        setBlocks(
                                          blocks.map((b) =>
                                            b.id === block.id
                                              ? {
                                                  ...b,
                                                  images: [
                                                    ...(b.images ?? []),
                                                    url,
                                                  ],
                                                }
                                              : b
                                          )
                                        )
                                      }
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      {(block.images ?? []).map((src) => (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          key={src}
                                          src={src}
                                          alt=""
                                          className="h-14 w-14 rounded object-cover"
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                {block.type === "faq" ? (
                                  <div className="space-y-2">
                                    {(block.faqItems ?? []).map((item, faqIndex) => (
                                      <div key={item.id} className="space-y-1">
                                        <Input
                                          value={item.question}
                                          onChange={(e) => {
                                            const faqItems = [
                                              ...(block.faqItems ?? []),
                                            ]
                                            faqItems[faqIndex] = {
                                              ...item,
                                              question: e.target.value,
                                            }
                                            setBlocks(
                                              blocks.map((b) =>
                                                b.id === block.id
                                                  ? { ...b, faqItems }
                                                  : b
                                              )
                                            )
                                          }}
                                        />
                                        <Textarea
                                          rows={2}
                                          value={item.answer}
                                          onChange={(e) => {
                                            const faqItems = [
                                              ...(block.faqItems ?? []),
                                            ]
                                            faqItems[faqIndex] = {
                                              ...item,
                                              answer: e.target.value,
                                            }
                                            setBlocks(
                                              blocks.map((b) =>
                                                b.id === block.id
                                                  ? { ...b, faqItems }
                                                  : b
                                              )
                                            )
                                          }}
                                        />
                                      </div>
                                    ))}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setBlocks(
                                          blocks.map((b) =>
                                            b.id === block.id
                                              ? {
                                                  ...b,
                                                  faqItems: [
                                                    ...(b.faqItems ?? []),
                                                    {
                                                      id: `faq-${Date.now()}`,
                                                      question: "Neue Frage",
                                                      answer: "",
                                                    },
                                                  ],
                                                }
                                              : b
                                          )
                                        )
                                      }
                                    >
                                      FAQ-Eintrag
                                    </Button>
                                  </div>
                                ) : null}

                                {block.type === "contact" ? (
                                  <div className="space-y-2">
                                    <Input
                                      value={block.ctaTitle ?? ""}
                                      placeholder="Abschnitt-Titel (z. B. Schreib uns…)"
                                      onChange={(e) =>
                                        setBlocks(
                                          blocks.map((b) =>
                                            b.id === block.id
                                              ? { ...b, ctaTitle: e.target.value }
                                              : b
                                          )
                                        )
                                      }
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Bindet das vollwertige Storefront-Kontaktformular ein.
                                    </p>
                                  </div>
                                ) : null}

                                {block.type === "valueCards" ? (
                                  <div className="space-y-3">
                                    {(block.cards ?? []).map((card, cardIndex) => (
                                      <div
                                        key={card.id}
                                        className="space-y-2 rounded-lg border border-border/50 p-3"
                                      >
                                        <Input
                                          value={card.icon}
                                          placeholder="Icon (Printer, CheckCircle2, HeartHandshake…)"
                                          onChange={(e) => {
                                            const cards = [...(block.cards ?? [])]
                                            cards[cardIndex] = {
                                              ...card,
                                              icon: e.target.value,
                                            }
                                            setBlocks(
                                              blocks.map((b) =>
                                                b.id === block.id
                                                  ? { ...b, cards }
                                                  : b
                                              )
                                            )
                                          }}
                                        />
                                        <Input
                                          value={card.title}
                                          placeholder="Titel"
                                          onChange={(e) => {
                                            const cards = [...(block.cards ?? [])]
                                            cards[cardIndex] = {
                                              ...card,
                                              title: e.target.value,
                                            }
                                            setBlocks(
                                              blocks.map((b) =>
                                                b.id === block.id
                                                  ? { ...b, cards }
                                                  : b
                                              )
                                            )
                                          }}
                                        />
                                        <Textarea
                                          rows={2}
                                          value={card.description}
                                          placeholder="Beschreibung"
                                          onChange={(e) => {
                                            const cards = [...(block.cards ?? [])]
                                            cards[cardIndex] = {
                                              ...card,
                                              description: e.target.value,
                                            }
                                            setBlocks(
                                              blocks.map((b) =>
                                                b.id === block.id
                                                  ? { ...b, cards }
                                                  : b
                                              )
                                            )
                                          }}
                                        />
                                      </div>
                                    ))}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setBlocks(
                                          blocks.map((b) =>
                                            b.id === block.id
                                              ? {
                                                  ...b,
                                                  cards: [
                                                    ...(b.cards ?? []),
                                                    {
                                                      id: `card-${Date.now()}`,
                                                      icon: "Sparkles",
                                                      title: "Neuer Vorteil",
                                                      description: "",
                                                    },
                                                  ],
                                                }
                                              : b
                                          )
                                        )
                                      }
                                    >
                                      Card hinzufügen
                                    </Button>
                                  </div>
                                ) : null}

                                {block.type === "cta" ? (
                                  <div className="space-y-2">
                                    <Input
                                      value={block.ctaTitle ?? ""}
                                      placeholder="CTA-Text"
                                      onChange={(e) =>
                                        setBlocks(
                                          blocks.map((b) =>
                                            b.id === block.id
                                              ? { ...b, ctaTitle: e.target.value }
                                              : b
                                          )
                                        )
                                      }
                                    />
                                    <Input
                                      value={block.ctaButtonLabel ?? ""}
                                      placeholder="Button-Label"
                                      onChange={(e) =>
                                        setBlocks(
                                          blocks.map((b) =>
                                            b.id === block.id
                                              ? {
                                                  ...b,
                                                  ctaButtonLabel: e.target.value,
                                                }
                                              : b
                                          )
                                        )
                                      }
                                    />
                                    <Input
                                      value={block.ctaButtonHref ?? ""}
                                      placeholder="/ueber-uns#kontakt"
                                      onChange={(e) =>
                                        setBlocks(
                                          blocks.map((b) =>
                                            b.id === block.id
                                              ? {
                                                  ...b,
                                                  ctaButtonHref: e.target.value,
                                                }
                                              : b
                                          )
                                        )
                                      }
                                    />
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {showPreview ? (
              <Card className={adminUi.card}>
                <CardContent className="p-4">
                  <p className="mb-3 text-sm font-semibold">Live-Vorschau</p>
                  <CmsCustomPageView page={selected} preview />
                </CardContent>
              </Card>
            ) : null}
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
