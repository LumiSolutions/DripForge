"use client"

import { useEffect, useRef, useState } from "react"
import { Bold, Highlighter, Loader2, Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import { DF_HIGHLIGHT_CLASS, looksLikeHtml } from "@/lib/dripforge/product-description-html"
import { legalToDisplayHtml, sanitizeLegalHtml } from "@/lib/dripforge/legal-html"
import type { SiteTextKey } from "@/lib/admin/site-texts"
import {
  CMS_CANCEL_EDITING_EVENT,
  CMS_SAVE_ALL_EVENT,
  reportCmsInlineEditing,
} from "@/lib/admin/cms-edit-history"
import { cn } from "@/lib/utils"

type LegalPageHeroProps = {
  badgeKey: SiteTextKey
  titlePrefixKey: SiteTextKey
  titleHighlightKey: SiteTextKey
  titleSuffixKey: SiteTextKey
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function stripHtmlToPlain(value: string): string {
  if (!value) return ""
  if (typeof document !== "undefined") {
    const el = document.createElement("div")
    el.innerHTML = value
    return (el.textContent || el.innerText || "").trim()
  }
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
}

/** Plain-Text-Titel aus den drei Legacy-Keys (ohne sichtbare HTML-Tags). */
function composePlainTitle(prefix: string, highlight: string, suffix: string): string {
  const mid = looksLikeHtml(highlight) ? stripHtmlToPlain(highlight) : highlight
  return `${prefix}${mid}${suffix}`.replace(/\s+/g, " ").trim()
}

/**
 * Anzeige-HTML: Legacy-Prefix/Suffix + Highlight (falls HTML bereits gespeichert)
 * oder Plain-Text. Standard = schwarze Schrift; Highlight-Spans nur wenn explizit gesetzt.
 */
function resolveTitleDisplayHtml(
  prefix: string,
  highlight: string,
  suffix: string
): string {
  if (looksLikeHtml(highlight) && !prefix.trim() && !suffix.trim()) {
    return legalToDisplayHtml(highlight)
  }
  // Legacy-Split: alles als Plain-Text zusammensetzen — kein Auto-Highlight mehr.
  const plain = composePlainTitle(prefix, highlight, suffix)
  return escapeText(plain) || "<br>"
}

function closestHighlight(node: Node | null): HTMLElement | null {
  let current: Node | null = node
  while (current) {
    if (
      current instanceof HTMLElement &&
      current.classList.contains(DF_HIGHLIGHT_CLASS)
    ) {
      return current
    }
    current = current.parentNode
  }
  return null
}

function unwrapElement(el: HTMLElement) {
  const parent = el.parentNode
  if (!parent) return
  while (el.firstChild) parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
}

const TITLE_HTML_CLASS = cn(
  "text-4xl font-bold tracking-tight text-foreground md:text-5xl",
  "[&_p]:m-0 [&_br]:leading-none",
  `[&_.${DF_HIGHLIGHT_CLASS}]:bg-gradient-to-r [&_.${DF_HIGHLIGHT_CLASS}]:from-primary [&_.${DF_HIGHLIGHT_CLASS}]:to-cyan-400 [&_.${DF_HIGHLIGHT_CLASS}]:bg-clip-text [&_.${DF_HIGHLIGHT_CLASS}]:text-transparent`,
  `[&_strong]:font-bold [&_b]:font-bold`
)

/**
 * Seitentitel im Theme-Stil (H1).
 * Standard: einheitliche schwarze Schrift. Highlights nur nach expliziter Markierung.
 */
export function LegalPageHero({
  badgeKey,
  titlePrefixKey,
  titleHighlightKey,
  titleSuffixKey,
}: LegalPageHeroProps) {
  const { t, canInlineEdit, saveText } = useSiteTexts()
  const prefix = t(titlePrefixKey)
  const highlight = t(titleHighlightKey)
  const suffix = t(titleSuffixKey)

  const displayHtml = resolveTitleDisplayHtml(prefix, highlight, suffix)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editing || !editorRef.current) return
    editorRef.current.innerHTML = displayHtml
    editorRef.current.focus()
  }, [editing, displayHtml])

  useEffect(() => {
    reportCmsInlineEditing(editing)
    return () => {
      if (editing) reportCmsInlineEditing(false)
    }
  }, [editing])

  const startEdit = () => {
    if (!canInlineEdit) return
    setError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setError(null)
  }

  const saveEdit = async () => {
    const raw = editorRef.current?.innerHTML ?? ""
    const cleaned = sanitizeLegalHtml(raw)
    const plain = stripHtmlToPlain(cleaned)
    if (!plain) {
      setError("Titel darf nicht leer sein.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Einheitlicher Rich-Text-Titel in highlight; Prefix/Suffix leeren
      await saveText(titlePrefixKey, "")
      await saveText(titleSuffixKey, "")
      await saveText(titleHighlightKey, cleaned)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen")
    } finally {
      setSaving(false)
    }
  }

  const saveEditRef = useRef(saveEdit)
  saveEditRef.current = saveEdit
  const cancelEditRef = useRef(cancelEdit)
  cancelEditRef.current = cancelEdit

  useEffect(() => {
    if (!editing) return
    const onSaveAll = () => {
      void saveEditRef.current()
    }
    const onCancel = () => {
      cancelEditRef.current()
    }
    window.addEventListener(CMS_SAVE_ALL_EVENT, onSaveAll)
    window.addEventListener(CMS_CANCEL_EDITING_EVENT, onCancel)
    return () => {
      window.removeEventListener(CMS_SAVE_ALL_EVENT, onSaveAll)
      window.removeEventListener(CMS_CANCEL_EDITING_EVENT, onCancel)
    }
  }, [editing])

  const exec = (command: string) => {
    document.execCommand(command, false)
  }

  const toggleHighlight = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    if (selection.isCollapsed) {
      const existing = closestHighlight(selection.anchorNode)
      if (existing) unwrapElement(existing)
      return
    }
    const range = selection.getRangeAt(0)
    const existing = closestHighlight(range.commonAncestorContainer)
    if (existing && existing.contains(range.commonAncestorContainer)) {
      unwrapElement(existing)
      return
    }
    const span = document.createElement("span")
    span.className = DF_HIGHLIGHT_CLASS
    try {
      range.surroundContents(span)
    } catch {
      const fragment = range.extractContents()
      span.appendChild(fragment)
      range.insertNode(span)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 text-center">
      <Badge variant="secondary" className="mb-4">
        <SiteText k={badgeKey} />
      </Badge>

      {editing ? (
        <div className="space-y-3">
          <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 px-0"
              title="Fett"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("bold")}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2"
              title="Hervorheben"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleHighlight}
            >
              <Highlighter className="h-4 w-4" />
              Highlight
            </Button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Seitentitel bearbeiten"
            className={cn(
              "mx-auto min-h-[1.2em] max-w-3xl rounded-md px-2 py-1 outline outline-1 outline-amber-500/60",
              TITLE_HTML_CLASS
            )}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault()
                cancelEdit()
              }
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault()
                void saveEdit()
              }
            }}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={cancelEdit}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void saveEdit()}
            >
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Speichern
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "group/title relative inline-flex max-w-full flex-col items-center",
            canInlineEdit &&
              "cursor-text rounded-sm outline-offset-4 hover:outline hover:outline-1 hover:outline-amber-500/50"
          )}
          onClick={() => {
            if (canInlineEdit) startEdit()
          }}
        >
          <h1 className={TITLE_HTML_CLASS}>
            <span dangerouslySetInnerHTML={{ __html: displayHtml }} />
          </h1>
          {canInlineEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="absolute -right-2 -top-3 z-20 gap-1.5 bg-background opacity-0 shadow-sm transition-opacity group-hover/title:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                startEdit()
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Titel
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
