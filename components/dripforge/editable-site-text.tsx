"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Loader2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import {
  getSiteTextFieldMeta,
  type SiteTextKey,
} from "@/lib/admin/site-texts"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import { cn } from "@/lib/utils"

type SiteTextEditorProps = {
  textKey: SiteTextKey
  value: string
  className?: string
  align?: "start" | "center" | "end"
}

export function SiteTextEditor({
  textKey,
  value,
  className,
  align = "start",
}: SiteTextEditorProps) {
  const { saveText } = useSiteTexts()
  const { label, multiline } = getSiteTextFieldMeta(textKey)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const handleCancel = () => {
    setDraft(value)
    setError(null)
    setOpen(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveText(textKey, draft)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            "text-muted-foreground/80 opacity-60 transition-opacity",
            "hover:bg-primary/10 hover:text-primary hover:opacity-100",
            "group-hover/site-text:opacity-100 focus-visible:opacity-100",
            open && "bg-primary/10 text-primary opacity-100",
            className
          )}
          aria-label={`${label} bearbeiten`}
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[350] w-80 space-y-3 p-4"
        align={align}
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="space-y-1">
          <Label htmlFor={`site-text-${textKey}`}>{label}</Label>
          <p className="text-[11px] text-muted-foreground">{textKey}</p>
        </div>
        {multiline ? (
          <Textarea
            id={`site-text-${textKey}`}
            rows={4}
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") handleCancel()
            }}
          />
        ) : (
          <Input
            id={`site-text-${textKey}`}
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") handleCancel()
              if (event.key === "Enter") void handleSave()
            }}
          />
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={saving}
            onClick={handleCancel}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Speichern
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

type SiteTextProps = {
  k: SiteTextKey
  className?: string
  as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "div"
  /** Trim surrounding whitespace in display (avoids double spaces with composed headings). */
  trim?: boolean
}

export function SiteText({ k, className, as: Tag = "span", trim = false }: SiteTextProps) {
  const { t, canInlineEdit } = useSiteTexts()
  const value = t(k)
  const displayValue = trim ? value.trim() : value

  if (!canInlineEdit) {
    return <Tag className={className}>{displayValue}</Tag>
  }

  return (
    <span className={cn("group/site-text inline-flex max-w-full items-start gap-1", className)}>
      <Tag className="min-w-0 flex-1">{displayValue}</Tag>
      <SiteTextEditor textKey={k} value={value} />
    </span>
  )
}

type EditableSiteTextFieldProps = {
  textKey: SiteTextKey
  children: ReactNode
  className?: string
}

/** Umschliesst Attribute-basierte Texte (Placeholder, title, aria-label) mit Stift-Icon. */
export function EditableSiteTextField({
  textKey,
  children,
  className,
}: EditableSiteTextFieldProps) {
  const { t, canInlineEdit } = useSiteTexts()
  const value = t(textKey)

  if (!canInlineEdit) {
    return <>{children}</>
  }

  return (
    <span className={cn("group/site-text relative inline-flex max-w-full items-center gap-1", className)}>
      {children}
      <SiteTextEditor textKey={textKey} value={value} align="end" />
    </span>
  )
}

export function useSiteTextValue(key: SiteTextKey): string {
  const { t } = useSiteTexts()
  return t(key)
}
