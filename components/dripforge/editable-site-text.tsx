"use client"

import Link, { type LinkProps } from "next/link"
import {
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react"
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
import { getDefaultSiteLinkHref } from "@/lib/admin/site-links"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import { cn } from "@/lib/utils"

type SiteTextEditorProps = {
  textKey: SiteTextKey
  value: string
  className?: string
  align?: "start" | "center" | "end"
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SiteTextEditor({
  textKey,
  value,
  className,
  align = "start",
  open: openControlled,
  onOpenChange,
}: SiteTextEditorProps) {
  const { saveText, saveLink, linkHref } = useSiteTexts()
  const { label, hrefEditable } = getSiteTextFieldMeta(textKey)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = openControlled ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const defaultHref = getDefaultSiteLinkHref(textKey) ?? ""
  const currentHref = linkHref(textKey, defaultHref || null)
  const [draft, setDraft] = useState(value)
  const [draftHref, setDraftHref] = useState(currentHref)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(value)
      setDraftHref(currentHref)
      setError(null)
    }
  }, [open, value, currentHref])

  const handleCancel = () => {
    setDraft(value)
    setDraftHref(currentHref)
    setError(null)
    setOpen(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveText(textKey, draft)
      if (hrefEditable) {
        const href = draftHref.trim() || defaultHref
        if (href) await saveLink(textKey, href)
      }
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
            "relative z-10 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            "text-muted-foreground/80 opacity-60 transition-opacity",
            "hover:bg-primary/10 hover:text-primary hover:opacity-100",
            "group-hover/site-text:opacity-100 focus-visible:opacity-100",
            open && "bg-primary/10 text-primary opacity-100",
            className
          )}
          aria-label={`${label} bearbeiten`}
          onPointerDown={(event) => {
            // Nur Propagation stoppen — preventDefault blockiert den Radix-Trigger-Click.
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()
            setOpen(true)
          }}
        >
          <Pencil className="h-3.5 w-3.5 relative z-10" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[350] w-80 space-y-3 p-4"
        align={align}
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-1">
          <Label htmlFor={`site-text-${textKey}`}>{label}</Label>
          <p className="text-[11px] text-muted-foreground">{textKey}</p>
        </div>
        <Textarea
          id={`site-text-${textKey}`}
          rows={3}
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") handleCancel()
          }}
        />
        {hrefEditable && (
          <div className="space-y-1">
            <Label htmlFor={`site-text-href-${textKey}`}>Ziel-URL</Label>
            <Input
              id={`site-text-href-${textKey}`}
              value={draftHref}
              placeholder={defaultHref || "/…"}
              onChange={(event) => setDraftHref(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") handleCancel()
              }}
            />
          </div>
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
  const [editorOpen, setEditorOpen] = useState(false)

  if (!canInlineEdit) {
    return <Tag className={cn("whitespace-pre-line", className)}>{displayValue}</Tag>
  }

  const stopNav = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <span
      className={cn(
        "group/site-text relative inline-flex max-w-full cursor-text items-start gap-1 rounded-sm",
        "outline-offset-2 hover:outline hover:outline-1 hover:outline-amber-500/50",
        className
      )}
      onClick={(event) => {
        stopNav(event)
        setEditorOpen(true)
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
    >
      <Tag className="min-w-0 flex-1 whitespace-pre-line">{displayValue}</Tag>
      <SiteTextEditor
        textKey={k}
        value={value}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
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
    <span
      className={cn("group/site-text relative inline-flex max-w-full items-center gap-1", className)}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
    >
      {children}
      <SiteTextEditor textKey={textKey} value={value} align="end" />
    </span>
  )
}

export function useSiteTextValue(key: SiteTextKey): string {
  const { t } = useSiteTexts()
  return t(key)
}

type SiteEditableLinkProps = LinkProps & {
  children: ReactNode
  className?: string
  /** Site-text key whose configured href should be used when present. */
  hrefKey?: SiteTextKey | string
}

/**
 * Link that uses editable site-config href when available and blocks navigation
 * while inline edit mode is active.
 */
export function SiteEditableLink({
  href,
  hrefKey,
  children,
  className,
  onClick,
  ...rest
}: SiteEditableLinkProps) {
  const { canInlineEdit, linkHref } = useSiteTexts()
  const resolvedHref = hrefKey
    ? linkHref(String(hrefKey), typeof href === "string" ? href : "/")
    : typeof href === "string"
      ? href
      : "/"

  return (
    <Link
      href={resolvedHref}
      className={className}
      {...rest}
      onClick={(event) => {
        if (canInlineEdit) {
          event.preventDefault()
          event.stopPropagation()
        }
        onClick?.(event)
      }}
    >
      {children}
    </Link>
  )
}
