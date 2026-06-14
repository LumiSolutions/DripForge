"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ProductTag } from "@/lib/admin/product-tags"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type AdminProductTagsSectionProps = {
  onTagsChange?: (tags: ProductTag[]) => void
}

export function AdminProductTagsSection({ onTagsChange }: AdminProductTagsSectionProps) {
  const [tags, setTags] = useState<ProductTag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState("")
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/product-tags", {
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Tags konnten nicht geladen werden.")
      const next = Array.isArray(data.tags) ? (data.tags as ProductTag[]) : []
      setTags(next)
      onTagsChange?.(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tags konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [onTagsChange])

  useEffect(() => {
    void load()
  }, [load])

  const createTag = async (e: FormEvent) => {
    e.preventDefault()
    const name = newTagName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/product-tags", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sortOrder: tags.length }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Tag konnte nicht erstellt werden.")
      setNewTagName("")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tag konnte nicht erstellt werden.")
    } finally {
      setCreating(false)
    }
  }

  const saveRename = async (id: string) => {
    const name = editName.trim()
    if (!name) return
    setError(null)
    try {
      const res = await fetch(`/api/admin/product-tags/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Tag konnte nicht umbenannt werden.")
      setEditingId(null)
      setEditName("")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tag konnte nicht umbenannt werden.")
    }
  }

  const removeTag = async (id: string) => {
    if (!confirm("Tag wirklich löschen? Er wird auch von allen Produkten entfernt.")) return
    setError(null)
    try {
      const res = await fetch(`/api/admin/product-tags/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Tag konnte nicht gelöscht werden.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tag konnte nicht gelöscht werden.")
    }
  }

  return (
    <div className={cn("rounded-xl border p-4", adminUi.section)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={cn("text-base font-semibold", adminUi.heading)}>Produkt-Tags</h3>
          <p className={cn("text-sm", adminUi.muted)}>
            Tags steuern die Filter im Shop — z. B. Figur, Deko, Untersetzer.
          </p>
        </div>
      </div>

      {error && <p className={cn("mb-3 text-sm", adminUi.errorLg)}>{error}</p>}

      <form onSubmit={(e) => void createTag(e)} className="mb-4 flex flex-wrap gap-2">
        <Input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="Neuer Tag, z. B. Deko"
          className={cn("min-w-[200px] flex-1", adminUi.input)}
        />
        <Button type="submit" disabled={creating || !newTagName.trim()} className={adminUi.primaryBtn}>
          {creating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Tag hinzufügen
        </Button>
      </form>

      {loading ? (
        <p className={cn("flex items-center gap-2 text-sm", adminUi.muted)}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Tags werden geladen…
        </p>
      ) : tags.length === 0 ? (
        <p className={cn("text-sm", adminUi.muted)}>Noch keine Tags angelegt.</p>
      ) : (
        <ul className="space-y-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2"
            >
              {editingId === tag.id ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={cn("min-w-[160px] flex-1", adminUi.input)}
                  />
                  <Button type="button" size="sm" onClick={() => void saveRename(tag.id)}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null)
                      setEditName("")
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className={cn("font-medium", adminUi.heading)}>{tag.name}</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={adminUi.outlineBtn}
                      onClick={() => {
                        setEditingId(tag.id)
                        setEditName(tag.name)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={adminUi.outlineBtn}
                      onClick={() => void removeTag(tag.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AdminProductTagCheckboxes({
  tags,
  selectedTagIds,
  onChange,
}: {
  tags: ProductTag[]
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
}) {
  if (tags.length === 0) {
    return (
      <p className={cn("text-sm", adminUi.muted)}>
        Noch keine Tags vorhanden — oben im Tag-Manager anlegen.
      </p>
    )
  }

  const toggle = (tagId: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...selectedTagIds, tagId])]
      : selectedTagIds.filter((id) => id !== tagId)
    onChange(next)
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {tags.map((tag) => (
        <label
          key={tag.id}
          className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={selectedTagIds.includes(tag.id)}
            onChange={(e) => toggle(tag.id, e.target.checked)}
          />
          {tag.name}
        </label>
      ))}
    </div>
  )
}
