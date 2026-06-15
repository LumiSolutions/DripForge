"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ProductTag } from "@/lib/admin/product-tags"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

const ADMIN_TAGS_API = "/api/admin/product-tags"

type AdminProductTagsSectionProps = {
  onTagsChange?: (tags: ProductTag[]) => void
}

type TagsApiPayload = {
  tags?: ProductTag[]
  tag?: ProductTag
  error?: string
}

function sortTags(tags: ProductTag[]): ProductTag[] {
  return [...tags].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")
  )
}

function reportTagApiError(action: string, status: number, payload: unknown, message: string) {
  console.error(`[Admin Produkt-Tags] ${action} fehlgeschlagen`, {
    status,
    payload,
    message,
  })
  alert(`Produkt-Tags: ${message}`)
}

async function requestAdminTags(
  action: string,
  url: string,
  init?: RequestInit
): Promise<TagsApiPayload> {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  })

  let payload: TagsApiPayload = {}
  try {
    payload = (await res.json()) as TagsApiPayload
  } catch {
    const message = `Ungültige Server-Antwort (HTTP ${res.status}).`
    reportTagApiError(action, res.status, null, message)
    throw new Error(message)
  }

  if (!res.ok) {
    const message = payload.error ?? `Anfrage fehlgeschlagen (HTTP ${res.status}).`
    reportTagApiError(action, res.status, payload, message)
    throw new Error(message)
  }

  return payload
}

export function AdminProductTagsSection({ onTagsChange }: AdminProductTagsSectionProps) {
  const [tags, setTags] = useState<ProductTag[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState("")
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const onTagsChangeRef = useRef(onTagsChange)

  useEffect(() => {
    onTagsChangeRef.current = onTagsChange
  }, [onTagsChange])

  const applyTags = useCallback((next: ProductTag[]) => {
    const sorted = sortTags(next)
    setTags(sorted)
    onTagsChangeRef.current?.(sorted)
  }, [])

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false
      if (silent) {
        setRefreshing(true)
      } else {
        setInitialLoading(true)
      }
      setError(null)

      try {
        const data = await requestAdminTags("Laden", ADMIN_TAGS_API, { method: "GET" })
        const next = Array.isArray(data.tags) ? data.tags : []
        applyTags(next)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Tags konnten nicht geladen werden."
        setError(message)
      } finally {
        if (silent) {
          setRefreshing(false)
        } else {
          setInitialLoading(false)
        }
      }
    },
    [applyTags]
  )

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
      const data = await requestAdminTags("Erstellen", ADMIN_TAGS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sortOrder: tags.length }),
      })

      if (Array.isArray(data.tags) && data.tags.length > 0) {
        applyTags(data.tags)
      } else if (data.tag) {
        applyTags([...tags.filter((tag) => tag.id !== data.tag!.id), data.tag])
      } else {
        throw new Error("Server hat keinen Tag zurückgegeben.")
      }

      setNewTagName("")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Tag konnte nicht erstellt werden."
      setError(message)
    } finally {
      setCreating(false)
    }
  }

  const saveRename = async (id: string) => {
    const name = editName.trim()
    if (!name) return
    setError(null)

    try {
      const data = await requestAdminTags("Umbenennen", `${ADMIN_TAGS_API}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      if (data.tag) {
        applyTags(tags.map((tag) => (tag.id === id ? data.tag! : tag)))
      } else {
        await load({ silent: true })
      }

      setEditingId(null)
      setEditName("")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Tag konnte nicht umbenannt werden."
      setError(message)
    }
  }

  const removeTag = async (id: string) => {
    if (!confirm("Tag wirklich löschen? Er wird auch von allen Produkten entfernt.")) return
    setError(null)

    try {
      await requestAdminTags("Löschen", `${ADMIN_TAGS_API}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      applyTags(tags.filter((tag) => tag.id !== id))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Tag konnte nicht gelöscht werden."
      setError(message)
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
        {refreshing && (
          <span className={cn("flex items-center gap-1 text-xs", adminUi.muted)}>
            <Loader2 className="h-3 w-3 animate-spin" />
            Aktualisiere…
          </span>
        )}
      </div>

      {error && <p className={cn("mb-3 text-sm", adminUi.errorLg)}>{error}</p>}

      <form onSubmit={(e) => void createTag(e)} className="mb-4 flex flex-wrap gap-2">
        <Input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="Neuer Tag, z. B. Deko"
          className={cn("min-w-[200px] flex-1", adminUi.input)}
          disabled={creating}
        />
        <Button
          type="submit"
          disabled={creating || !newTagName.trim()}
          className={adminUi.primaryBtn}
        >
          {creating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Tag hinzufügen
        </Button>
      </form>

      {initialLoading ? (
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
