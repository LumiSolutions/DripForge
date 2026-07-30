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
import { applySubjectKeepMask } from "@/lib/dripforge/subject-segmentation"

export type CutoutTool = "erase" | "restore" | "pipette"

const TOOL_HINTS: Record<CutoutTool, string> = {
  erase: "Radiergummi aktiv — Wische über Bereiche zum Löschen",
  restore:
    "Wiederherstellen-Pinsel aktiv — Wische über gelöschte Stellen zum Wiederherstellen",
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

/**
 * Mappt CSS-Touch-Koordinaten auf Canvas-Pixel unter object-fit: contain
 * (inkl. Letterboxing — kritisch für iOS Safari).
 */
function clientToCanvasPixel(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): { x: number; y: number; scale: number; rect: DOMRect } | null {
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0 || canvas.width <= 0 || canvas.height <= 0) {
    return null
  }
  const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height)
  const dispW = canvas.width * scale
  const dispH = canvas.height * scale
  const offsetX = (rect.width - dispW) / 2
  const offsetY = (rect.height - dispH) / 2
  const x = (clientX - rect.left - offsetX) / scale
  const y = (clientY - rect.top - offsetY) / scale
  return { x, y, scale, rect }
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
  const pointerIdRef = useRef<number | null>(null)

  const [tool, setTool] = useState<CutoutTool>("erase")
  const [brushSize, setBrushSize] = useState(28)
  const [tolerance, setTolerance] = useState(36)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusHint, setStatusHint] = useState(TOOL_HINTS.erase)
  const [magnifier, setMagnifier] = useState<{
    x: number
    y: number
    clientX: number
    clientY: number
    visible: boolean
  }>({ x: 0, y: 0, clientX: 0, clientY: 0, visible: false })

  const paintCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const working = workingRef.current
    if (!canvas || !working) return
    canvas.width = working.width
    canvas.height = working.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.putImageData(working, 0, 0)
    const processedSrc = canvas.toDataURL("image/png")
    const maskOverlaySrc = imageDataToDataUrl(buildMaskHighlightOverlay(working))
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

  const applyBrushAt = (clientX: number, clientY: number) => {
    const working = workingRef.current
    const original = originalRef.current
    const canvas = canvasRef.current
    if (!working || !original || !canvas) return
    const coords = clientToCanvasPixel(canvas, clientX, clientY)
    if (!coords) return
    const radiusPx = (brushSize / 2) / coords.scale
    if (tool === "erase") {
      brushErase(working, coords.x, coords.y, radiusPx)
    } else if (tool === "restore") {
      brushRestore(working, original, coords.x, coords.y, radiusPx)
    }
    paintCanvas()
    setMagnifier({
      x: clientX,
      y: clientY - 88,
      clientX,
      clientY,
      visible: true,
    })
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    drawingRef.current = true
    pointerIdRef.current = e.pointerId
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (tool === "pipette") {
      const working = workingRef.current
      const canvas = canvasRef.current
      if (!working || !canvas) return
      const coords = clientToCanvasPixel(canvas, e.clientX, e.clientY)
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
        setMagnifier({
          x: e.clientX,
          y: e.clientY - 88,
          clientX: e.clientX,
          clientY: e.clientY,
          visible: true,
        })
      }
      return
    }
    if (
      pointerIdRef.current !== null &&
      e.pointerId !== pointerIdRef.current
    ) {
      return
    }
    e.preventDefault()
    if (tool === "pipette") return
    applyBrushAt(e.clientX, e.clientY)
  }

  const endStroke = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false
    pointerIdRef.current = null
    setMagnifier((m) => ({ ...m, visible: false }))
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
  }

  const runSubjectKeep = async () => {
    const working = workingRef.current
    if (!working) return
    setStatusHint("Subjekt-/Vordergrund-Erkennung läuft…")
    setLoading(true)
    try {
      const target = cloneImageData(working)
      await applySubjectKeepMask(target)
      workingRef.current = target
      paintCanvas()
      setStatusHint("Subjekt beibehalten — Hintergrund ist transparent")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Subjekt-Erkennung fehlgeschlagen"
      )
      setStatusHint("Subjekt-Erkennung fehlgeschlagen — manuell nacharbeiten")
    } finally {
      setLoading(false)
    }
  }

  const resetWorking = () => {
    const original = originalRef.current
    if (!original) return
    workingRef.current = cloneImageData(original)
    paintCanvas()
    setStatusHint("Zurückgesetzt")
  }

  if (!open) return null

  return (
    <div className="space-y-3 rounded-xl border border-pink-500/30 bg-card/90 p-3 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Freistell-Studio</h4>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onPointerDown={(e) => {
            e.preventDefault()
            onClose()
          }}
          aria-label="Schliessen"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["erase", "Löschen", Eraser],
            ["restore", "Wiederherstellen", Undo2],
            ["pipette", "Pipette", Droplet],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium",
              tool === id
                ? "border-pink-500 bg-pink-500/15 text-foreground"
                : "border-border/60 text-muted-foreground"
            )}
            onClick={() => setTool(id)}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-xs font-medium text-cyan-400"
          onClick={() => void runSubjectKeep()}
          disabled={loading}
        >
          <ScanFace className="h-3.5 w-3.5" />
          Subjekt
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border/60 px-3 text-xs font-medium text-muted-foreground"
          onClick={resetWorking}
        >
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

      <div
        className="relative overflow-hidden rounded-lg border border-border/50 bg-secondary/30 overscroll-none"
        style={{ touchAction: "none", overscrollBehavior: "none" }}
      >
        {loading ? (
          <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Bild wird geladen…
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="mx-auto block max-h-[50vh] w-full touch-none select-none"
            style={{
              touchAction: "none",
              overscrollBehavior: "none",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          />
        )}
        {magnifier.visible &&
        canvasRef.current &&
        (tool === "erase" || tool === "restore") ? (
          <MagnifierLens
            canvas={canvasRef.current}
            clientX={magnifier.clientX}
            clientY={magnifier.clientY}
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
          onPointerDown={(e) => {
            e.preventDefault()
            const working = workingRef.current
            if (!working) return
            onApply(imageDataToDataUrl(working))
          }}
        >
          Übernehmen
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
    const mapped = clientToCanvasPixel(canvas, clientX, clientY)
    if (!mapped) return
    const srcSize = 40
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(
      canvas,
      mapped.x - srcSize / 2,
      mapped.y - srcSize / 2,
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
        top: Math.max(8, anchorY - 48),
      }}
    />
  )
}

export type { Rgba }
