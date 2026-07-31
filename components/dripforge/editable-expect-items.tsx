"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import {
  createEmptyExpectItem,
  type CmsExpectItem,
} from "@/lib/admin/cms-page-content"

type Variant = "3d" | "laser"

function detailHref(variant: Variant, slug: string) {
  return variant === "3d"
    ? `/3d-druck/erwartungen/${slug}`
    : `/laser/erwartungen/${slug}`
}

export function EditableExpectItems({ variant }: { variant: Variant }) {
  const {
    canInlineEdit,
    expectItems3d,
    expectItemsLaser,
    saveExpectItems3d,
    saveExpectItemsLaser,
  } = useSiteTexts()
  const items = variant === "3d" ? expectItems3d : expectItemsLaser
  const save = variant === "3d" ? saveExpectItems3d : saveExpectItemsLaser
  const [saving, setSaving] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const persist = async (next: CmsExpectItem[]) => {
    setSaving(true)
    try {
      await save(next)
    } finally {
      setSaving(false)
    }
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const tmp = next[index]!
    next[index] = next[target]!
    next[target] = tmp
    await persist(next.map((item, i) => ({ ...item, sortOrder: i })))
  }

  const update = async (id: string, patch: Partial<CmsExpectItem>) => {
    await persist(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const onImage = (id: string, file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null
      if (result) void update(id, { imageUrl: result })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-6">
      {canInlineEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            «Was Sie erwartet» — Titel, Texte, Material und Produktbilder
            verwalten.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() =>
              void persist([...items, createEmptyExpectItem(items.length)])
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Beispiel hinzufügen
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {items.map((item, index) => (
          <Card
            key={item.id}
            className="overflow-hidden border-border/50 bg-card/50"
          >
            <div className="relative flex h-48 items-center justify-center bg-secondary/50">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/20">
                  <Zap className="h-8 w-8 text-cyan-400" />
                </div>
              )}
              {item.materialLabel ? (
                <Badge className="absolute right-4 top-4" variant="secondary">
                  {item.materialLabel}
                </Badge>
              ) : null}
            </div>
            <CardContent className="space-y-3 p-6">
              {canInlineEdit ? (
                <>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      disabled={index === 0 || saving}
                      onClick={() => void move(index, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      disabled={index === items.length - 1 || saving}
                      onClick={() => void move(index, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => fileRefs.current[item.id]?.click()}
                    >
                      <ImagePlus className="mr-1 h-3.5 w-3.5" />
                      Bild
                    </Button>
                    <input
                      ref={(el) => {
                        fileRefs.current[item.id] = el
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        onImage(item.id, e.target.files?.[0] ?? null)
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="ml-auto h-8 w-8 text-red-600"
                      onClick={() => {
                        if (items.length <= 1) return
                        if (!window.confirm("Beispiel löschen?")) return
                        void persist(
                          items
                            .filter((entry) => entry.id !== item.id)
                            .map((entry, i) => ({ ...entry, sortOrder: i }))
                        )
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Titel</Label>
                    <Input
                      value={item.title}
                      onChange={(e) =>
                        void update(item.id, { title: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Material</Label>
                    <Input
                      value={item.materialLabel}
                      onChange={(e) =>
                        void update(item.id, { materialLabel: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Beschreibung</Label>
                    <Textarea
                      value={item.description}
                      rows={3}
                      onChange={(e) =>
                        void update(item.id, { description: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Slug (Detailseite)</Label>
                    <Input
                      value={item.slug}
                      onChange={(e) =>
                        void update(item.id, { slug: e.target.value })
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mb-2 font-bold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  <Button asChild variant="link" className="h-auto px-0">
                    <Link href={detailHref(variant, item.slug)}>Details</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
