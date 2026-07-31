"use client"

import { useCallback, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import { Crop, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

async function cropImageToDataUrl(
  imageSrc: string,
  crop: Area
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."))
    img.src = imageSrc
  })

  const canvas = document.createElement("canvas")
  const size = Math.max(512, Math.round(Math.max(crop.width, crop.height)))
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas nicht verfügbar.")

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    size,
    size
  )
  return canvas.toDataURL("image/jpeg", 0.92)
}

type AdminImageCropDialogProps = {
  imageUrl: string | null | undefined
  onCropped: (dataUrl: string) => void | Promise<void>
  title?: string
  triggerLabel?: string
}

export function AdminImageCropDialog({
  imageUrl,
  onCropped,
  title = "Vorschau zuschneiden / zoomen",
  triggerLabel = "Zuschneiden",
}: AdminImageCropDialogProps) {
  const [open, setOpen] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedArea(pixels)
  }, [])

  const apply = async () => {
    if (!imageUrl || !croppedArea) return
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await cropImageToDataUrl(imageUrl, croppedArea)
      await onCropped(dataUrl)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zuschneiden fehlgeschlagen.")
    } finally {
      setBusy(false)
    }
  }

  if (!imageUrl) return null

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={adminUi.outlineBtn}
        onClick={() => {
          setZoom(1)
          setCrop({ x: 0, y: 0 })
          setOpen(true)
        }}
      >
        <Crop className="mr-1 h-3.5 w-3.5" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="relative h-72 w-full overflow-hidden rounded-xl bg-black/90">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="space-y-2">
            <Label className={adminUi.label}>Zoom</Label>
            <Slider
              min={1}
              max={3}
              step={0.05}
              value={[zoom]}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
            />
            <p className={cn("text-xs", adminUi.muted)}>
              Zoome auf die Gravurfläche (z. B. Anhänger), damit Kunden den Detailbereich
              klar sehen.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={() => void apply()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Zuschnitt übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
