"use client"

import { useEffect, useRef } from "react"
import { Bold, Highlighter, Italic, Underline } from "lucide-react"
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
}

function exec(command: string, value?: string) {
  document.execCommand(command, false, value)
}

export function ProductDescriptionEditor({
  value,
  onChange,
  className,
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

  const wrapHighlight = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
    const range = selection.getRangeAt(0)
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
          onClick={() => {
            exec("bold")
            emitChange()
          }}
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
          onClick={() => {
            exec("italic")
            emitChange()
          }}
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
          onClick={() => {
            exec("underline")
            emitChange()
          }}
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
          title="Hervorheben"
          onMouseDown={(e) => e.preventDefault()}
          onClick={wrapHighlight}
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
        aria-label="Produktbeschreibung"
        className={cn(
          "min-h-[96px] max-h-[320px] overflow-y-auto px-3 py-2 text-sm outline-none",
          "prose prose-sm dark:prose-invert max-w-none",
          "bg-background focus-visible:ring-0"
        )}
        onInput={emitChange}
        onBlur={emitChange}
      />
    </div>
  )
}
