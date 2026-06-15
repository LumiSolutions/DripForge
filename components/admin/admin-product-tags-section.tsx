"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { FolderInput, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  PRODUCT_TAG_GROUPS,
  type ProductTag,
} from "@/lib/admin/product-tags"
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
  return [...tags].sort((a, b) => {
    const groupCmp = (a.group || "Allgemein").localeCompare(b.group || "Allgemein", "de")
    if (groupCmp !== 0) return groupCmp
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")
  })
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
  const [newTagGroup, setNewTagGroup] = useState<string>(PRODUCT_TAG_GROUPS[0])
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editGroup, setEditGroup] = useState<string>(PRODUCT_TAG_GROUPS[0])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
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

  const allSelected = tags.length > 0 && selectedIds.length === tags.length
  const someSelected = selectedIds.length > 0 && !allSelected

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? tags.map((tag) => tag.id) : [])
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((entry) => entry !== id)
    )
  }

  const runTagBulk = async (body: Record<string, unknown>) => {
    setBulkBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/product-tags/bulk", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, ...body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Bulk-Aktion fehlgeschlagen")
      setSelectedIds([])
      await load({ silent: true })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Bulk-Aktion fehlgeschlagen."
      setError(message)
      alert(`Produkt-Tags: ${message}`)
    } finally {
      setBulkBusy(false)
    }
  }

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
        body: JSON.stringify({ name, sortOrder: tags.length, group: newTagGroup }),
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
        body: JSON.stringify({ name, group: editGroup }),
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
      setSelectedIds((prev) => prev.filter((entry) => entry !== id))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Tag konnte nicht gelöscht werden."
      setError(message)
    }
  }

  if (initialLoading) {
    return (
      <p className={cn("flex items-center gap-2 py-12 text-sm", adminUi.muted)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Tags werden geladen…
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={cn("text-sm", adminUi.muted)}>
            {tags.length} Tags — steuern die Filter im Shop
          </p>
        </div>
        {refreshing && (
          <span className={cn("flex items-center gap-1 text-xs", adminUi.muted)}>
            <Loader2 className="h-3 w-3 animate-spin" />
            Aktualisiere…
          </span>
        )}
      </div>

      {error && <p className={cn("text-sm", adminUi.errorLg)}>{error}</p>}

      <form onSubmit={(e) => void createTag(e)} className="flex flex-wrap gap-2">
        <Input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="Neuer Tag, z. B. Deko"
          className={cn("min-w-[200px] flex-1", adminUi.input)}
          disabled={creating}
        />
        <Select value={newTagGroup} onValueChange={setNewTagGroup}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Gruppe" />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_TAG_GROUPS.map((group) => (
              <SelectItem key={group} value={group}>
                {group}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={creating || !newTagName.trim()} className={adminUi.primaryBtn}>
          {creating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Tag hinzufügen
        </Button>
      </form>

      {selectedIds.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3",
            adminUi.section
          )}
        >
          <span className={cn("text-sm font-medium", adminUi.heading)}>
            {selectedIds.length} Tags ausgewählt
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={adminUi.outlineBtn}
                disabled={bulkBusy}
              >
                <FolderInput className="mr-1.5 h-4 w-4" />
                Gruppe zuweisen
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {PRODUCT_TAG_GROUPS.map((group) => (
                <DropdownMenuItem
                  key={group}
                  onClick={() => void runTagBulk({ group })}
                >
                  {group}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-red-500/40 text-red-500 hover:bg-red-500/10"
            disabled={bulkBusy}
            onClick={() => {
              if (
                !confirm(
                  `${selectedIds.length} Tag(s) wirklich löschen? Sie werden von allen Produkten entfernt.`
                )
              ) {
                return
              }
              void runTagBulk({ action: "delete" })
            }}
          >
            {bulkBusy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-4 w-4" />
            )}
            Löschen
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={adminUi.muted}
            disabled={bulkBusy}
            onClick={() => setSelectedIds([])}
          >
            Auswahl aufheben
          </Button>
        </div>
      )}

      <div className={cn("overflow-hidden rounded-xl border", adminUi.section)}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  aria-label="Alle Tags auswählen"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Gruppe</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className={cn("py-10 text-center text-sm", adminUi.muted)}>
                  Noch keine Tags angelegt.
                </TableCell>
              </TableRow>
            ) : (
              tags.map((tag) => (
                <TableRow key={tag.id} className={selectedIds.includes(tag.id) ? "bg-muted/30" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(tag.id)}
                      onCheckedChange={(value) => toggleOne(tag.id, value === true)}
                      aria-label={`${tag.name} auswählen`}
                    />
                  </TableCell>
                  <TableCell>
                    {editingId === tag.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={cn("max-w-xs", adminUi.input)}
                      />
                    ) : (
                      <span className={cn("font-medium", adminUi.heading)}>{tag.name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === tag.id ? (
                      <Select value={editGroup} onValueChange={setEditGroup}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_TAG_GROUPS.map((group) => (
                            <SelectItem key={group} value={group}>
                              {group}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={cn("text-sm", adminUi.muted)}>
                        {tag.group || "Allgemein"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {editingId === tag.id ? (
                        <>
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
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={adminUi.outlineBtn}
                            onClick={() => {
                              setEditingId(tag.id)
                              setEditName(tag.name)
                              setEditGroup(tag.group || PRODUCT_TAG_GROUPS[0])
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
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
        Noch keine Tags vorhanden — unter „Produkt-Tags verwalten“ anlegen.
      </p>
    )
  }

  const toggle = (tagId: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...selectedTagIds, tagId])]
      : selectedTagIds.filter((id) => id !== tagId)
    onChange(next)
  }

  const grouped = PRODUCT_TAG_GROUPS.map((group) => ({
    group,
    items: tags.filter((tag) => (tag.group || "Allgemein") === group),
  })).filter((entry) => entry.items.length > 0)

  const ungrouped = tags.filter(
    (tag) => !PRODUCT_TAG_GROUPS.includes((tag.group || "Allgemein") as (typeof PRODUCT_TAG_GROUPS)[number])
  )

  const renderTag = (tag: ProductTag) => (
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
  )

  return (
    <div className="space-y-4">
      {grouped.map(({ group, items }) => (
        <div key={group} className="space-y-2">
          <p className={cn("text-xs font-semibold uppercase tracking-wide", adminUi.muted)}>
            {group}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">{items.map(renderTag)}</div>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div className="space-y-2">
          <p className={cn("text-xs font-semibold uppercase tracking-wide", adminUi.muted)}>
            Sonstige
          </p>
          <div className="grid gap-2 sm:grid-cols-2">{ungrouped.map(renderTag)}</div>
        </div>
      )}
    </div>
  )
}
