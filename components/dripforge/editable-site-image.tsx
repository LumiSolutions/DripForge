"use client"

import Image from "next/image"
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { Camera, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  getSiteImageFieldMeta,
  type SiteImageEntry,
  type SiteImageKey,
} from "@/lib/admin/site-images"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import { cn } from "@/lib/utils"

type SiteImageEditorProps = {
  imageKey: SiteImageKey
  value: SiteImageEntry
  align?: "start" | "center" | "end"
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SiteImageEditor({
  imageKey,
  value,
  align = "end",
  open: openControlled,
  onOpenChange,
}: SiteImageEditorProps) {
  const { saveImage, mediaLibrary } = useSiteTexts()
  const { label } = getSiteImageFieldMeta(imageKey)
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = openControlled ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [draftUrl, setDraftUrl] = useState(value.url)
  const [draftAlt, setDraftAlt] = useState(value.alt)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraftUrl(value.url)
      setDraftAlt(value.alt)
      setError(null)
      setUploadSuccess(null)
    }
  }, [open, value.alt, value.url])

  const handleCancel = () => {
    setDraftUrl(value.url)
    setDraftAlt(value.alt)
    setError(null)
    setOpen(false)
  }

  const handleSave = async () => {
    const url = draftUrl.trim()
    if (!url) {
      setError("Bitte eine Bild-URL angeben oder ein Bild hochladen.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveImage(imageKey, { url, alt: draftAlt.trim() })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen")
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Nur Bilddateien sind erlaubt.")
      return
    }

    setUploading(true)
    setError(null)
    setUploadSuccess(null)
    try {
      const formData = new FormData()
      formData.set("file", file)
      formData.set("productId", "site-config")
      formData.set("category", "site-images")

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      const data = (await res.json().catch(() => null)) as {
        url?: string
        error?: string
      } | null
      if (!res.ok || !data?.url) {
        throw new Error(data?.error ?? "Upload fehlgeschlagen.")
      }
      setDraftUrl(data.url)
      setUploadSuccess("Upload erfolgreich (Azure). Bitte Speichern klicken.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const busy = saving || uploading

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "absolute right-2 top-2 z-[60] inline-flex h-8 w-8 items-center justify-center rounded-md",
            "border border-white/30 bg-black/55 text-white shadow-sm backdrop-blur-sm",
            "opacity-0 transition-opacity",
            "hover:bg-black/70 group-hover/site-image:opacity-100 focus-visible:opacity-100",
            open && "opacity-100"
          )}
          aria-label={`${label} ändern`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            setOpen(true)
          }}
        >
          <Camera className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[350] w-[22rem] space-y-3 p-4"
        align={align}
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[11px] text-muted-foreground">{imageKey}</p>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-md border border-border/60 bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draftUrl || value.url}
            alt={draftAlt || value.alt || label}
            className="h-full w-full object-contain"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fileInputId}-upload`}>Bild hochladen</Label>
          <input
            ref={fileInputRef}
            id={`${fileInputId}-upload`}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              void handleUpload(event.target.files?.[0] ?? null)
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Datei wählen
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fileInputId}-url`}>Bild-URL</Label>
          <Input
            id={`${fileInputId}-url`}
            value={draftUrl}
            disabled={busy}
            placeholder="https://…"
            onChange={(event) => setDraftUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") handleCancel()
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fileInputId}-alt`}>Alt-Text</Label>
          <Input
            id={`${fileInputId}-alt`}
            value={draftAlt}
            disabled={busy}
            placeholder="Beschreibung für SEO & Barrierefreiheit"
            onChange={(event) => setDraftAlt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") handleCancel()
              if (event.key === "Enter") void handleSave()
            }}
          />
        </div>

        {mediaLibrary.length > 0 && (
          <div className="space-y-2">
            <Label>Vorhandene Medien</Label>
            <div className="grid max-h-28 grid-cols-4 gap-2 overflow-y-auto">
              {mediaLibrary.map((url) => (
                <button
                  key={url}
                  type="button"
                  disabled={busy}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded border border-border/50 bg-muted/20",
                    draftUrl === url && "ring-2 ring-primary"
                  )}
                  onClick={() => setDraftUrl(url)}
                  aria-label="Medienbild auswählen"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
        {uploadSuccess && !error && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300">{uploadSuccess}</p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={handleCancel}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1"
            disabled={busy}
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

type SiteImageProps = {
  imageKey: SiteImageKey
  className?: string
  imageClassName?: string
  fill?: boolean
  width?: number
  height?: number
  priority?: boolean
  sizes?: string
  style?: CSSProperties
  /** Zusätzlicher Wrapper-Stil (z. B. absolute inset-0) */
  wrapperClassName?: string
}

export function SiteImage({
  imageKey,
  className,
  imageClassName,
  fill,
  width,
  height,
  priority,
  sizes,
  style,
  wrapperClassName,
}: SiteImageProps) {
  const { image, canInlineEdit } = useSiteTexts()
  const entry = image(imageKey)
  const [editorOpen, setEditorOpen] = useState(false)

  const img = (
    <Image
      src={entry.url}
      alt={entry.alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      priority={priority}
      sizes={sizes}
      className={imageClassName}
      style={style}
      unoptimized={entry.url.startsWith("data:")}
    />
  )

  if (!canInlineEdit) {
    if (fill) {
      return (
        <span className={cn("absolute inset-0 block", wrapperClassName, className)}>
          {img}
        </span>
      )
    }
    return (
      <span className={cn("relative inline-block", wrapperClassName, className)}>
        {img}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "group/site-image relative block cursor-pointer",
        fill && "absolute inset-0",
        wrapperClassName,
        className
      )}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setEditorOpen(true)
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {img}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[50] flex items-center justify-center",
          "bg-black/0 transition-colors group-hover/site-image:bg-black/25"
        )}
      >
        <span
          className={cn(
            "rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white",
            "opacity-0 transition-opacity group-hover/site-image:opacity-100"
          )}
        >
          Bild ändern
        </span>
      </div>
      <SiteImageEditor
        imageKey={imageKey}
        value={entry}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </span>
  )
}

export function useSiteImageValue(key: SiteImageKey): SiteImageEntry {
  const { image } = useSiteTexts()
  return image(key)
}
