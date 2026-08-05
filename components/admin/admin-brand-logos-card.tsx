"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { invalidateBrandingCache } from "@/hooks/use-branding"
import { cn } from "@/lib/utils"

type Slot = "icon" | "logo"

export function AdminBrandLogosCard() {
  const [iconUrl, setIconUrl] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<Slot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        setIconUrl(typeof data?.brandIconUrl === "string" ? data.brandIconUrl : null)
        setLogoUrl(typeof data?.brandLogoUrl === "string" ? data.brandLogoUrl : null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const upload = async (slot: Slot, file: File) => {
    setUploading(slot)
    setError(null)
    setNotice(null)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("slot", slot)
      const res = await fetch("/api/admin/settings/brand-logos", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Upload fehlgeschlagen")
      setIconUrl(data?.brandIconUrl ?? null)
      setLogoUrl(data?.brandLogoUrl ?? null)
      setNotice(
        slot === "icon"
          ? "Icon-Marke gespeichert — Favicon & Apple-Touch-Icon werden aktualisiert."
          : "Haupt-Logo gespeichert."
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.")
    } finally {
      setUploading(null)
    }
  }

  const remove = async (slot: Slot) => {
    setUploading(slot)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/admin/settings/brand-logos?slot=${slot}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Entfernen fehlgeschlagen")
      setIconUrl(data?.brandIconUrl ?? null)
      setLogoUrl(data?.brandLogoUrl ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Entfernen fehlgeschlagen.")
    } finally {
      setUploading(null)
    }
  }

  const renderSlot = (
    slot: Slot,
    title: string,
    hint: string,
    url: string | null,
    inputRef: React.RefObject<HTMLInputElement | null>,
    previewClass: string
  ) => (
    <div className="space-y-2 rounded-lg border border-border/60 p-4">
      <div>
        <p className={cn("text-sm font-semibold", adminUi.heading)}>{title}</p>
        <p className={cn("mt-0.5 text-xs", adminUi.muted)}>{hint}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/40">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={title} className={previewClass} />
          ) : (
            <span className="text-[10px] text-muted-foreground">kein Bild</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/svg+xml,image/png,image/webp,image/jpeg,image/x-icon,.ico"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(slot, file)
              e.target.value = ""
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading === slot}
            onClick={() => inputRef.current?.click()}
          >
            {uploading === slot ? "Lädt …" : url ? "Ersetzen" : "Hochladen"}
          </Button>
          {url && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              disabled={uploading === slot}
              onClick={() => void remove(slot)}
            >
              Entfernen
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <Card className={adminUi.card}>
      <CardContent className="space-y-4 p-6">
        <div>
          <h3 className={cn("text-lg font-bold", adminUi.heading)}>Marken-Logos</h3>
          <p className={cn("mt-1 text-sm", adminUi.muted)}>
            Zwei Logo-Slots für Header/Footer/Favicon und die grosse Darstellung.
          </p>
        </div>

        {loading ? (
          <p className={cn("text-sm", adminUi.muted)}>Lädt …</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {renderSlot(
              "icon",
              "Kleine Icon-Marke / Favicon",
              "Header oben links, Footer sowie Browser-Tab (Favicon) & Apple-Touch-Icon. Empfohlen: quadratisch, PNG/SVG.",
              iconUrl,
              iconInputRef,
              "h-full w-full object-contain"
            )}
            {renderSlot(
              "logo",
              "Haupt- / Branding-Logo",
              "Grosse Darstellung im Hero-Bereich der Startseite.",
              logoUrl,
              logoInputRef,
              "h-full w-full object-contain"
            )}
          </div>
        )}

        <Label className={cn("text-xs", adminUi.muted)}>
          Erlaubt: SVG, PNG, WebP, JPG oder ICO (max. 1 MB).
        </Label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>
        )}
      </CardContent>
    </Card>
  )
}
