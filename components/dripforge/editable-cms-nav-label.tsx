"use client"

import { useEffect, useRef, useState } from "react"
import { Pencil } from "lucide-react"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import { cn } from "@/lib/utils"

type EditableCmsNavLabelProps = {
  navId: string
  label: string
  className?: string
}

export function EditableCmsNavLabel({
  navId,
  label,
  className,
}: EditableCmsNavLabelProps) {
  const { canInlineEdit, updateNavItemLabel } = useSiteTexts()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(label)
  }, [label])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (!canInlineEdit) {
    return <span className={className}>{label}</span>
  }

  const commit = async () => {
    const next = draft.trim()
    setEditing(false)
    if (!next || next === label) {
      setDraft(label)
      return
    }
    setSaving(true)
    try {
      await updateNavItemLabel(navId, next)
    } catch {
      setDraft(label)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onClick={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === "Enter") {
            e.preventDefault()
            void commit()
          }
          if (e.key === "Escape") {
            e.preventDefault()
            setDraft(label)
            setEditing(false)
          }
        }}
        className={cn(
          "min-w-[4rem] max-w-[10rem] rounded border border-amber-500/60 bg-background px-1.5 py-0.5 text-sm font-medium outline-none",
          className
        )}
        data-cms-nav-edit={navId}
        aria-label="Navigationslabel bearbeiten"
      />
    )
  }

  return (
    <span
      className={cn(
        "group/nav-label inline-flex items-center gap-1 rounded px-0.5 outline-none ring-offset-background",
        "hover:bg-amber-500/15 focus-visible:ring-2 focus-visible:ring-amber-500",
        className
      )}
      data-cms-nav-label={navId}
      role="button"
      tabIndex={0}
      title="Klicken zum Bearbeiten"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setEditing(true)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          e.stopPropagation()
          setEditing(true)
        }
      }}
    >
      {label}
      <Pencil className="h-3 w-3 opacity-0 transition group-hover/nav-label:opacity-70" />
    </span>
  )
}
