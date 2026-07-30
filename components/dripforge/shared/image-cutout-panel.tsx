"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Droplet,
  Eraser,
  Loader2,
  ScanFace,
  Undo2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  brushErase,
  brushRestore,
  buildMaskHighlightOverlay,
  cloneImageData,
  eraseByColorTolerance,
  imageDataToDataUrl,
  loadImageDataFromSrc,
  samplePixel,
  type Rgba,
} from "@/lib/dripforge/image-cutout-engine"
import { applyPersonKeepMask } from "@/lib/dripforge/person-segmentation"

export type CutoutTool = "erase" | "restore" | "pipette"

const TOOL_HINTS: Record<CutoutTool, string> = {
  erase: "Radiergummi aktiv — Wische über Bereiche zum Löschen",
  restore: "Wiederherstellen-Pinsel aktiv — Wische über gelöschte Stellen zum Wiederherstellen",
  pipette: "Pipette aktiv — Tippe eine Farbe an, die entfernt werden soll",
}

type ImageCutoutPanelProps = {
  sourceSrc: string
  open: boolean
  onClose: () => void
  onApply: (processedDataUrl: string) => void
  /** Live-Highlight (pink) für Haupt-Canvas */
  onLivePreviewChange?: (preview: {
    processedSrc: string
    maskOverlaySrc: string | null
  } | null) => void
}

export function ImageCutoutPanel({
  sourceSrc,
  open,
  onClose,
  onApply,
  onLivePreviewChange,
}: ImageCutoutPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const originalRef = useRef<ImageData | null>(null)
  const workingRef = useRef<ImageData | null>(null)
  const drawingRef = useRef(false)
  const [tool, setTool] = useState<CutoutTool>("erase")
  const [brushSize, setBrushSize] = useState(28)
  const [tolerance, setTolerance] = useState(36)
  const [keepPerson, setKeepPerson] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magnifier, setMagnifier] = useState<{
    x: number
    y: number
    visible: boolean
  }>({ x: 0, y: 0, visible: false })
  const [statusHint, setStatusHint] = useState(TOOL_HINTS.erase)

  const paintCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const working = workingRef.current
    if (!canvas || !working) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    if (canvas.width !== working.width || canvas.height !== working.height) {
      canvas.width = working.width
      canvas.height = working.height
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Checkerboard for transparency
    const size = 12
    for (let y = 0; y < canvas.height; y += size) {
      for (let x = 0; x < canvas.width; x += size) {
        const odd = ((x / size) | 0) + ((y / size) | 0)
        ctx.fillStyle = odd % 2 === 0 ? "#e5e7eb" : "#ffffff"
        ctx.fillRect(x, y, size, size)
      }
    }
    ctx.putImageData(working, 0, 0)

    const processedSrc = imageDataToDataUrl(working)
    const mask = buildMaskHighlightOverlay(working)
    const maskOverlaySrc = imageDataToDataUrl(mask)
    onLivePreviewChange?.({ processedSrc, maskOverlaySrc })
  }, [onLivePreviewChange])

  useEffect(() => {
    if (!open) {
      onLivePreviewChange?.(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void loadImageDataFromSrc(sourceSrc)
      .then(({ original, working }) => {
        if (cancelled) return
        originalRef.current = original
        workingRef.current = working
        paintCanvas()
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Bild laden fehlgeschlagen")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, sourceSrc, paintCanvas, onLivePreviewChange])

  useEffect(() => {
    setStatusHint(TOOL_HINTS[tool])
  }, [tool])

  const canvasToImageCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const x = ((clientX - rect.left) / rect.width) * canvas.width
    const y = ((clientY - rect.top) / rect.height) * canvas.height
    return { x, y, rect }
  }

  const applyBrushAt = (clientX: number, clientY: number) => {
    const working = workingRef.current
    const original = originalRef.current
    if (!working || !original) return
    const coords = canvasToImageCoords(clientX, clientY)
    if (!coords) return
    const scale = working.width / Math.max(1, coords.rect.width)
    const radius = (brushSize / 2) * scale
    if (tool === "erase") {
      brushErase(working, coords.x, coords.y, radius)
    } else if (tool === "restore") {
      brushRestore(working, original, coords.x, coords.y, radius)
    }
    paintCanvas()
    setMagnifier({
      x: clientX,
      y: clientY - 72,
      visible: true,
    })
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
    drawingRef.current = true
    if (tool === "pipette") {
      const working = workingRef.current
      if (!working) return
      const coords = canvasToImageCoords(e.clientX, e.clientY)
      if (!coords) return
      const color = samplePixel(working, coords.x, coords.y)
      if (!color) return
      eraseByColorTolerance(working, color, tolerance)
      paintCanvas()
      setStatusHint("Farbe entfernt — ggf. Toleranz anpassen")
      return
    }
    applyBrushAt(e.clientX, e.clientY)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) {
      if (tool === "erase" || tool === "restore") {
        setMagnifier({ x: e.clientX, y: e.clientY - 72, visible: true })
      }
      return
    }
    e.preventDefault()
    if (tool === "pipette") return
    applyBrushAt(e.clientX, e.clientY)
  }

  const endStroke = () => {
    drawingRef.current = false
    setMagnifier((m) => ({ ...m, visible: false }))
  }

  const runPersonKeep = async () => {
    const working = workingRef.current
    if (!working) return
    setBusy(true)
    setError(null)
    setStatusHint("Personen-Erkennung läuft…")
    try {
      // Reset from original then mask
      const original = originalRef.current
      if (original) {
        workingRef.current = cloneImageData(original)
      }
      const target = workingRef.current
      if (!target) return
      await applyPersonKeepMask(target)
      paintCanvas()
      setKeepPerson(true)
      setStatusHint("Personen beibehalten — Hintergrund ist transparent")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Personen-Erkennung fehlgeschlagen"
      )
      setStatusHint("Personen-Erkennung fehlgeschlagen — manuell nacharbeiten")
    } finally {
      setBusy(false)
    }
  }

  const resetWorking = () => {
    const original = originalRef.current
    if (!original) return
    workingRef.current = cloneImageData(original)
    setKeepPerson(false)
    paintCanvas()
    setStatusHint("Original wiederhergestellt")
  }

  const activateTool = (next: CutoutTool) => {
    setTool(next)
    setStatusHint(TOOL_HINTS[next])
  }

  if (!open) return null

  return (
    <div className="relative space-y-3 rounded-xl border border-pink-500/30 bg-card/80 p-3 shadow-lg sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-pink-400">Freistellen</h4>
          <p className="text-xs text-muted-foreground">
            Bearbeite auf HD-Daten — Auswahl erscheint live auf dem Haupt-Canvas.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-11 w-11 shrink-0"
          onPointerDown={(e) => {
            e.preventDefault()
            onClose()
          }}
          aria-label="Schliessen"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            { id: "erase" as const, icon: Eraser, label: "Radieren", invert: false },
            {
              id: "restore" as const,
              icon: Eraser,
              label: "Wiederherstellen",
              invert: true,
            },
            { id: "pipette" as const, icon: Droplet, label: "Pipette", invert: false },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 text-[10px] font-medium transition-colors",
              tool === item.id
                ? "border-pink-500 bg-pink-500/15 text-pink-400"
                : "border-border/60 bg-background/40 text-muted-foreground"
            )}
            onPointerDown={(e) => {
              e.preventDefault()
              activateTool(item.id)
            }}
          >
            <item.icon
              className={cn("h-5 w-5", item.invert && "scale-x-[-1] rotate-180")}
            />
            {item.label}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          className={cn(
            "inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 text-[10px] font-medium",
            keepPerson
              ? "border-cyan-500 bg-cyan-500/15 text-cyan-400"
              : "border-border/60 bg-background/40 text-muted-foreground"
          )}
          onPointerDown={(e) => {
            e.preventDefault()
            void runPersonKeep()
          }}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ScanFace className="h-5 w-5" />
          )}
          Personen
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-[10px] font-medium text-muted-foreground"
          onPointerDown={(e) => {
            e.preventDefault()
            resetWorking()
          }}
        >
          <Undo2 className="h-5 w-5" />
          Reset
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Pinselgrösse: {brushSize}px
          <input
            type="range"
            min={8}
            max={80}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Farbtoleranz: {tolerance}
          <input
            type="range"
            min={4}
            max={120}
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border/50 bg-secondary/30">
        {loading ? (
          <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Bild wird geladen…
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="max-h-[50vh] w-full touch-none object-contain"
            style={{ touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
          />
        )}
        {magnifier.visible && canvasRef.current && (tool === "erase" || tool === "restore") ? (
          <MagnifierLens
            canvas={canvasRef.current}
            clientX={magnifier.x + 0}
            clientY={magnifier.y + 72}
            anchorX={magnifier.x}
            anchorY={magnifier.y}
          />
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      <div className="rounded-md bg-secondary/50 px-3 py-2 text-center text-xs text-muted-foreground sm:hidden">
        {statusHint}
      </div>
      <p className="hidden text-xs text-muted-foreground sm:block">{statusHint}</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onPointerDown={(e) => {
            e.preventDefault()
            onClose()
          }}
        >
          Abbrechen
        </Button>
        <Button
          type="button"
          className="min-h-11 bg-pink-600 hover:bg-pink-600/90"
          disabled={!workingRef.current || loading}
          onPointerDown={(e) => {
            e.preventDefault()
            const working = workingRef.current
            if (!working) return
            const url = imageDataToDataUrl(working)
            if (url) onApply(url)
          }}
        >
          Auf Vorschau anwenden
        </Button>
      </div>
    </div>
  )
}

function MagnifierLens({
  canvas,
  clientX,
  clientY,
  anchorX,
  anchorY,
}: {
  canvas: HTMLCanvasElement
  clientX: number
  clientY: number
  anchorX: number
  anchorY: number
}) {
  const lensRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const lens = lensRef.current
    if (!lens) return
    const size = 96
    lens.width = size
    lens.height = size
    const ctx = lens.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const sx = ((clientX - rect.left) / rect.width) * canvas.width
    const sy = ((clientY - rect.top) / rect.height) * canvas.height
    const srcSize = 40
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(
      canvas,
      sx - srcSize / 2,
      sy - srcSize / 2,
      srcSize,
      srcSize,
      0,
      0,
      size,
      size
    )
    ctx.strokeStyle = "rgba(236,72,153,0.9)"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
    ctx.stroke()
  }, [canvas, clientX, clientY])

  return (
    <canvas
      ref={lensRef}
      className="pointer-events-none fixed z-[80] h-24 w-24 rounded-full border-2 border-pink-400 shadow-xl"
      style={{
        left: anchorX - 48,
        top: anchorY - 48,
      }}
    />
  )
}

// silence unused Rgba import warning if tree-shaken differently
export type { Rgba }
