"use client"

import { useEffect, useRef } from "react"
import {
  Bold,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Underline,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DF_HIGHLIGHT_CLASS } from "@/lib/dripforge/product-description-html"
import { cn } from "@/lib/utils"
import { adminUi } from "@/lib/admin/admin-ui-classes"

const FONT_OPTIONS = [
  { id: "Inter", label: "Inter", css: "Inter, sans-serif" },
  { id: "Georgia", label: "Georgia", css: "Georgia, serif" },
  { id: "Montserrat", label: "Montserrat", css: "Montserrat, sans-serif" },
  {
    id: "JetBrains Mono",
    label: "JetBrains Mono",
    css: '"JetBrains Mono", monospace',
  },
] as const

type ProductDescriptionEditorProps = {
  value: string
  onChange: (html: string) => void
  className?: string
  /** Zusätzliche Block-Formate (H1/H2, Listen) für Rich-Text (z. B. Rechtstexte). */
  enableBlockFormats?: boolean
  ariaLabel?: string
  /** Überschreibt die Höhe des Editier-Bereichs. */
  editorClassName?: string
}

function exec(command: string, value?: string) {
  document.execCommand(command, false, value)
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
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el)
  }
  parent.removeChild(el)
}

/** Entfernt Highlight-Spans, die die Selection ganz oder teilweise umfassen. */
function unwrapHighlightsInRange(range: Range): boolean {
  const root =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as HTMLElement)
      : range.commonAncestorContainer.parentElement
  if (!root) return false

  const highlights = Array.from(
    root.querySelectorAll(`.${DF_HIGHLIGHT_CLASS}`)
  ) as HTMLElement[]

  // Auch Ancestor der Selection prüfen
  const startHighlight = closestHighlight(range.startContainer)
  const endHighlight = closestHighlight(range.endContainer)
  const candidates = new Set(highlights)
  if (startHighlight) candidates.add(startHighlight)
  if (endHighlight) candidates.add(endHighlight)

  let unwrapped = false
  for (const span of candidates) {
    try {
      if (
        range.intersectsNode(span) ||
        span.contains(range.commonAncestorContainer)
      ) {
        unwrapElement(span)
        unwrapped = true
      }
    } catch {
      /* ignore */
    }
  }
  return unwrapped
}

export function ProductDescriptionEditor({
  value,
  onChange,
  className,
  enableBlockFormats = false,
  ariaLabel = "Produktbeschreibung",
  editorClassName,
}: ProductDescriptionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef<string | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (!initialized.current) {
      el.innerHTML = value || ""
      lastEmitted.current = value || ""
      initialized.current = true
      return
    }
    if (value === lastEmitted.current) return
    // Nur aktualisieren wenn Editor nicht fokussiert — sonst Selection/Toggle kaputt
    if (document.activeElement === el) return
    if (el.innerHTML !== value) {
      el.innerHTML = value || ""
      lastEmitted.current = value || ""
    }
  }, [value])

  const emitChange = () => {
    const html = editorRef.current?.innerHTML ?? ""
    lastEmitted.current = html
    onChange(html)
  }

  const toggleFormat = (command: "bold" | "italic" | "underline") => {
    exec(command)
    emitChange()
  }

  const toggleHighlight = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    // Collapsed caret innerhalb eines Highlights → ganzes Highlight entfernen
    if (selection.isCollapsed) {
      const anchor = selection.anchorNode
      const existing = closestHighlight(anchor)
      if (existing) {
        unwrapElement(existing)
        emitChange()
      }
      return
    }

    const range = selection.getRangeAt(0)

    // Toggle OFF: vorhandenes Highlight entfernen
    if (unwrapHighlightsInRange(range.cloneRange())) {
      selection.removeAllRanges()
      emitChange()
      return
    }

    // Toggle ON: neu wrappen
    const span = document.createElement("span")
    span.className = DF_HIGHLIGHT_CLASS
    try {
      range.surroundContents(span)
    } catch {
      const fragment = range.extractContents()
      span.appendChild(fragment)
      range.insertNode(span)
    }
    selection.removeAllRanges()
    const next = document.createRange()
    next.selectNodeContents(span)
    selection.addRange(next)
    emitChange()
  }

  const applyFont = (fontCss: string) => {
    exec("fontName", fontCss)
    emitChange()
  }

  const applyBlock = (tag: "h1" | "h2" | "p") => {
    exec("formatBlock", tag)
    emitChange()
  }

  const applyList = (ordered: boolean) => {
    exec(ordered ? "insertOrderedList" : "insertUnorderedList")
    emitChange()
  }

  return (
    <div className={cn("overflow-hidden rounded-md border border-border/60", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60 bg-muted/30 p-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 px-0"
          title="Fett"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleFormat("bold")}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 px-0"
          title="Kursiv"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleFormat("italic")}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 px-0"
          title="Unterstrichen"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleFormat("underline")}
        >
          <Underline className="h-4 w-4" />
        </Button>
        <select
          className={cn(
            "h-8 max-w-[160px] rounded-md border border-border/60 bg-background px-2 text-xs",
            adminUi.select
          )}
          defaultValue=""
          aria-label="Schriftart"
          onChange={(e) => {
            const opt = FONT_OPTIONS.find((f) => f.id === e.target.value)
            if (opt) applyFont(opt.css)
            e.target.value = ""
          }}
        >
          <option value="" disabled>
            Schriftart
          </option>
          {FONT_OPTIONS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-xs"
          title="Hervorheben ein/aus"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleHighlight}
        >
          <Highlighter className="h-4 w-4" />
          Highlight
        </Button>
        {enableBlockFormats && (
          <>
            <span className="mx-1 h-5 w-px bg-border/60" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0"
              title="Überschrift 1"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyBlock("h1")}
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0"
              title="Überschrift 2"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyBlock("h2")}
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0"
              title="Aufzählung"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyList(false)}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0"
              title="Nummerierte Liste"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyList(true)}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel}
        className={cn(
          "min-h-[96px] max-h-[320px] overflow-y-auto px-3 py-2 text-sm outline-none",
          "prose prose-sm dark:prose-invert max-w-none",
          "bg-background text-foreground focus-visible:ring-0",
          "[&_.df-text-highlight]:font-bold",
          "[&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          editorClassName
        )}
        onInput={emitChange}
        onBlur={emitChange}
      />
    </div>
  )
}
