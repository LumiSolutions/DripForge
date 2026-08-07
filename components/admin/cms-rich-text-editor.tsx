"use client"

import { useCallback, useEffect, useRef } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Highlighter,
  Italic,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CmsRichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  className?: string
  minHeightClassName?: string
}

function runCommand(command: string, value?: string) {
  try {
    document.execCommand(command, false, value)
  } catch {
    /* ignore */
  }
}

export function CmsRichTextEditor({
  value,
  onChange,
  className,
  minHeightClassName = "min-h-[140px]",
}: CmsRichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.innerHTML !== value) {
      el.innerHTML = value || "<p></p>"
    }
  }, [value])

  const emit = useCallback(() => {
    const html = ref.current?.innerHTML ?? ""
    onChange(html)
  }, [onChange])

  const apply = (command: string, commandValue?: string) => {
    ref.current?.focus()
    runCommand(command, commandValue)
    emit()
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border/60", className)}>
      <div className="flex flex-wrap gap-1 border-b border-border/60 bg-muted/30 p-1.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title="Fett"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply("bold")}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title="Kursiv"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply("italic")}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title="Highlight"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply("hiliteColor", "#fde68a")}
        >
          <Highlighter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title="Überschrift"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply("formatBlock", "h2")}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title="Links"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply("justifyLeft")}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title="Zentriert"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply("justifyCenter")}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title="Rechts"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply("justifyRight")}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          "prose prose-neutral max-w-none bg-background px-3 py-2 text-sm outline-none dark:prose-invert",
          minHeightClassName
        )}
        onInput={emit}
        onBlur={emit}
      />
    </div>
  )
}
