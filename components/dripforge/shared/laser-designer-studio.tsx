"use client"

import { useCallback, useLayoutEffect, useEffect, useRef, useState } from "react"
import type { CSSProperties, RefObject } from "react"
import {
  CheckCircle2,
  ChevronDown,
  Crop,
  Crosshair,
  Eraser,
  Info,
  Lasso,
  Layers,
  Maximize2,
  Plus,
  Pipette,
  RotateCw,
  Scissors,
  Stamp,
  Trash2,
  Type,
  Undo2,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  clampScale,
  DEFAULT_IMAGE_LAYOUT,
  DEFAULT_LASER_FONT_ID,
  DEFAULT_TEXT_LAYOUT,
  elementTransformStyle,
  getLaserFontDropdownStyle,
  getLaserFontFamily,
  getLaserFontInputStyle,
  getLaserFontStyle,
  LASER_FONT_OPTIONS,
  getMaterialCanvasStyle,
  MIN_LAYOUT_SCALE,
  normalizeRotation,
  pointerAngleDegrees,
  resolvedScaleXY,
  type ElementLayout,
  type ImageLayout,
  type LaserFontId,
} from "@/lib/dripforge/laser-design"
import {
  clampLayoutPosition,
  clampLayoutScaleToFit,
  computeMaxScaleToFitBounds,
  ENGRAVING_FRAME_USABLE_FRACTION,
  fitLayoutScaleToBounds,
  measureElementMm,
  scaleForTargetHeightMm,
  scaleForTargetWidthMm,
  type ElementMmSize,
} from "@/lib/dripforge/laser-canvas-layout"
import {
  createImageLayer,
  createTextLayer,
  deriveCompatFromLayers,
  ensureLaserLayers,
  layerToElementLayout,
  nextLayerOffset,
  removeLayerById,
  updateLayerById,
  type LaserDesignLayer,
  type LaserDesignerState,
} from "@/lib/dripforge/laser-layers"
import {
  removeLightImageBackground,
  removeColorNearBackground,
  sampleImageColorAt,
  type RgbColor,
} from "@/lib/dripforge/remove-image-background"
import {
  cropImageToRelRect,
  eraseImageBrushStroke,
  eraseImageLassoRegion,
  interpolateBrushPoints,
} from "@/lib/dripforge/erase-image-brush"
import {
  computeResizeScales,
  RESIZE_HANDLES,
  resizeHandleClass,
  type ResizeHandle,
} from "@/lib/dripforge/canvas-resize-handles"
import {
  CAPTURE_HIDE_ATTR,
  LEITBILD_LASER_PREVIEW_ATTR,
} from "@/lib/dripforge/capture-leitbild"
import {
  DEFAULT_WORK_AREA_MM,
  type WorkAreaMm,
} from "@/lib/dripforge/laser-work-area"
import type { LaserMaterial } from "@/lib/dripforge/types"
import { Checkbox } from "@/components/ui/checkbox"

export type { LaserDesignerState } from "@/lib/dripforge/laser-layers"

type LaserDesignerBaseProps = {
  material: LaserMaterial
  productName: string
  state: LaserDesignerState
  onStateChange: (patch: Partial<LaserDesignerState>) => void
}

export type LaserEngravingMetrics = {
  text: ElementMmSize | null
  image: ElementMmSize | null
  active: ElementMmSize | null
  maxAreaMm2: number
}

type LaserDesignerStudioProps = LaserDesignerBaseProps & {
  column: "settings" | "preview"
  workAreaMm?: WorkAreaMm
  showMaterialCard?: boolean
  showVariantPicker?: boolean
  /** Text-Layer-Editor in der Settings-Spalte (sonst im Preview) */
  showTextLayers?: boolean
  /** Produkt-Varianten aus Admin (Stichworte); leer = keine Auswahl */
  varianten?: string[]
  /** Admin-Hintergrundbild für Laser-Individualisierung */
  customizationBackgroundUrl?: string
  onEngravingMetricsChange?: (metrics: LaserEngravingMetrics) => void
  /** Ref auf die Live-Vorschau-Fläche für Leitbild-Snapshot beim Warenkorb */
  previewSurfaceRef?: RefObject<HTMLDivElement | null>
}

function FeatureTag({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        allowed
          ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
          : "border-border/60 bg-secondary/50 text-muted-foreground"
      )}
    >
      {allowed ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3 opacity-60" />}
      {label}
    </span>
  )
}

export function createDefaultLaserDesignerState(
  material: LaserMaterial,
  varianten: string[] = []
): LaserDesignerState {
  return {
    selectedVariant: varianten[0] ?? "",
    selectedFont: DEFAULT_LASER_FONT_ID,
    engravingText: "",
    textLayout: { ...DEFAULT_TEXT_LAYOUT },
    imageLayout: { ...DEFAULT_IMAGE_LAYOUT },
    layers: [],
    activeLayerId: null,
  }
}

type DragMode = "move" | "resize" | "rotate"

type DragSession = {
  mode: DragMode
  /** Layer-ID */
  target: string
  pointerId: number
  startLayout: ElementLayout
  startClientX: number
  startClientY: number
  startPointerAngle: number
  startDistance: number
  centerClientX: number
  centerClientY: number
  /** Einmalig beim Drag-Start gemessen — verhindert Zittern */
  halfWPercent: number
  halfHPercent: number
  maxScale: number
  resizeHandle?: ResizeHandle
  proportional?: boolean
}

/** Sperrt Browser-Scroll/-Select/-Drag während Canvas-Gesten (Mobil + Desktop). */
const CANVAS_TOUCH_LOCK_CLASS =
  "touch-none select-none [-webkit-user-drag:none] [-webkit-touch-callout:none]"

const CANVAS_TOUCH_LOCK_STYLE: CSSProperties = {
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  // Safari / Chromium: verhindert natives Bild-Ziehen (nicht in CSSProperties typisiert)
  ...({ WebkitUserDrag: "none" } as CSSProperties),
}

const FALLBACK_MAX_SCALE = 10

function getCanvasPoint(
  canvas: HTMLDivElement,
  clientX: number,
  clientY: number
) {
  const rect = canvas.getBoundingClientRect()
  return {
    rect,
    percentX: ((clientX - rect.left) / rect.width) * 100,
    percentY: ((clientY - rect.top) / rect.height) * 100,
    clientX,
    clientY,
  }
}

function getElementCenterPx(canvas: HTMLDivElement, layout: ElementLayout) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: rect.left + (layout.x / 100) * rect.width,
    y: rect.top + (layout.y / 100) * rect.height,
  }
}

function buildDragSession(
  canvas: HTMLDivElement,
  layout: ElementLayout,
  target: string,
  mode: DragMode,
  pointerId: number,
  clientX: number,
  clientY: number,
  innerEl: HTMLElement | null,
  options?: { resizeHandle?: ResizeHandle; proportional?: boolean }
): DragSession {
  const center = getElementCenterPx(canvas, layout)
  const canvasRect = canvas.getBoundingClientRect()
  let halfWPercent = 12
  let halfHPercent = 12
  let maxScale = FALLBACK_MAX_SCALE

  if (innerEl && canvasRect.width > 0 && canvasRect.height > 0) {
    const elRect = innerEl.getBoundingClientRect()
    halfWPercent = (elRect.width / canvasRect.width) * 50
    halfHPercent = (elRect.height / canvasRect.height) * 50
    maxScale = computeMaxScaleToFitBounds(
      canvas,
      innerEl,
      layout,
      ENGRAVING_FRAME_USABLE_FRACTION
    )
  }

  return {
    mode,
    target,
    pointerId,
    startLayout: { ...layout },
    startClientX: clientX,
    startClientY: clientY,
    startPointerAngle: pointerAngleDegrees(center.x, center.y, clientX, clientY),
    startDistance: Math.hypot(clientX - center.x, clientY - center.y) || 1,
    centerClientX: center.x,
    centerClientY: center.y,
    halfWPercent,
    halfHPercent,
    maxScale,
    resizeHandle: options?.resizeHandle,
    proportional: options?.proportional,
  }
}

function InteractiveCanvasElement({
  layerId,
  layout,
  isActive,
  isMoving,
  stackIndex,
  canvasRef,
  onSelect,
  onDragStart,
  onInnerRef,
  className,
  style,
  kind,
  eyedropperActive,
  eraserActive,
  lassoActive,
  cropActive,
  proportionalScale,
  onEyedropperSample,
  onEraserPaint,
  onLassoPoint,
  onLassoComplete,
  onCropDrag,
  onCropComplete,
  onDelete,
  onRotateStep,
  onScaleStep,
  onBringForward,
  onSendBackward,
  onEditText,
  children,
}: {
  layerId: string
  layout: ElementLayout
  isActive: boolean
  isMoving: boolean
  stackIndex: number
  canvasRef: React.RefObject<HTMLDivElement | null>
  onSelect: () => void
  onDragStart: (session: DragSession) => void
  onInnerRef?: (el: HTMLElement | null) => void
  className?: string
  style?: React.CSSProperties
  kind: "text" | "image"
  eyedropperActive?: boolean
  eraserActive?: boolean
  lassoActive?: boolean
  cropActive?: boolean
  proportionalScale?: boolean
  onEyedropperSample?: (relX: number, relY: number, layerId: string) => void
  onEraserPaint?: (relX: number, relY: number) => void
  onLassoPoint?: (relX: number, relY: number) => void
  onLassoComplete?: () => void
  onCropDrag?: (
    start: { relX: number; relY: number },
    end: { relX: number; relY: number }
  ) => void
  onCropComplete?: (
    start: { relX: number; relY: number },
    end: { relX: number; relY: number }
  ) => void
  onDelete?: () => void
  onRotateStep?: () => void
  onScaleStep?: (delta: number) => void
  onBringForward?: () => void
  onSendBackward?: () => void
  onEditText?: () => void
  children: React.ReactNode
}) {
  const localInnerRef = useRef<HTMLElement | null>(null)
  const cropStartRef = useRef<{ relX: number; relY: number } | null>(null)
  const [cropPreview, setCropPreview] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)

  const setInnerRef = (el: HTMLElement | null) => {
    localInnerRef.current = el
    onInnerRef?.(el)
  }

  const beginDragAt = (
    mode: DragMode,
    pointerId: number,
    clientX: number,
    clientY: number,
    options?: { resizeHandle?: ResizeHandle; proportional?: boolean }
  ) => {
    onSelect()
    const canvas = canvasRef.current
    if (!canvas) return
    const session = buildDragSession(
      canvas,
      layout,
      layerId,
      mode,
      pointerId,
      clientX,
      clientY,
      localInnerRef.current,
      options
    )
    try {
      canvas.setPointerCapture(pointerId)
    } catch {
      // Touch-Fallback ohne Pointer-Capture
    }
    onDragStart(session)
  }

  const beginPointerDrag = (
    e: React.PointerEvent,
    mode: DragMode,
    options?: { resizeHandle?: ResizeHandle; proportional?: boolean }
  ) => {
    e.preventDefault()
    e.stopPropagation()
    beginDragAt(mode, e.pointerId, e.clientX, e.clientY, options)
  }

  const beginTouchDrag = (
    e: React.TouchEvent,
    mode: DragMode,
    options?: { resizeHandle?: ResizeHandle; proportional?: boolean }
  ) => {
    if (typeof window !== "undefined" && "PointerEvent" in window) return
    const touch = e.touches[0]
    if (!touch) return
    e.preventDefault()
    e.stopPropagation()
    beginDragAt(mode, touch.identifier, touch.clientX, touch.clientY, options)
  }

  const isHandleTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(target.closest("[data-handle]"))
  }

  const relFromEvent = (el: HTMLElement, clientX: number, clientY: number) => {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return {
      relX: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      relY: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    }
  }

  const toolModeActive =
    Boolean(eyedropperActive) ||
    Boolean(eraserActive) ||
    Boolean(lassoActive) ||
    Boolean(cropActive)

  const zIndex = 10 + stackIndex + (isActive ? 1 : 0)
  const toolCursor =
    eyedropperActive && kind === "image" && isActive
      ? "cursor-crosshair"
      : eraserActive && kind === "image" && isActive
        ? "cursor-cell"
        : lassoActive && kind === "image" && isActive
          ? "cursor-crosshair"
          : cropActive && kind === "image" && isActive
            ? "cursor-crosshair"
            : isMoving
              ? "cursor-grabbing"
              : "cursor-grab"

  const showChrome = isActive && !toolModeActive && !isMoving

  return (
    <div
      className={cn("absolute", CANVAS_TOUCH_LOCK_CLASS)}
      style={{
        ...elementTransformStyle(layout),
        ...CANVAS_TOUCH_LOCK_STYLE,
        zIndex,
      }}
      data-canvas-element={layerId}
    >
      <div
        ref={setInnerRef}
        data-drag-body={layerId}
        className={cn(
          "relative inline-block",
          CANVAS_TOUCH_LOCK_CLASS,
          kind === "text" ? "w-max max-w-none" : "max-w-full",
          toolCursor,
          className
        )}
        style={{ ...CANVAS_TOUCH_LOCK_STYLE, ...style }}
        onDoubleClick={(e) => {
          if (kind !== "text") return
          e.preventDefault()
          e.stopPropagation()
          onSelect()
          onEditText?.()
        }}
        onPointerDown={(e) => {
          if (isHandleTarget(e.target)) return
          if (eyedropperActive && kind === "image") {
            e.preventDefault()
            e.stopPropagation()
            onSelect()
            const rel = relFromEvent(e.currentTarget, e.clientX, e.clientY)
            if (rel) onEyedropperSample?.(rel.relX, rel.relY, layerId)
            return
          }
          if (eraserActive && kind === "image") {
            e.preventDefault()
            e.stopPropagation()
            onSelect()
            const rel = relFromEvent(e.currentTarget, e.clientX, e.clientY)
            if (rel) onEraserPaint?.(rel.relX, rel.relY)
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              /* ignore */
            }
            return
          }
          if (lassoActive && kind === "image") {
            e.preventDefault()
            e.stopPropagation()
            onSelect()
            const rel = relFromEvent(e.currentTarget, e.clientX, e.clientY)
            if (rel) onLassoPoint?.(rel.relX, rel.relY)
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              /* ignore */
            }
            return
          }
          if (cropActive && kind === "image") {
            e.preventDefault()
            e.stopPropagation()
            onSelect()
            const rel = relFromEvent(e.currentTarget, e.clientX, e.clientY)
            if (!rel) return
            cropStartRef.current = rel
            setCropPreview({ x: rel.relX, y: rel.relY, w: 0, h: 0 })
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              /* ignore */
            }
            return
          }
          e.stopPropagation()
          beginPointerDrag(e, "move")
        }}
        onPointerMove={(e) => {
          if (eraserActive && kind === "image" && e.buttons !== 0) {
            const rel = relFromEvent(e.currentTarget, e.clientX, e.clientY)
            if (rel) onEraserPaint?.(rel.relX, rel.relY)
            return
          }
          if (lassoActive && kind === "image" && e.buttons !== 0) {
            const rel = relFromEvent(e.currentTarget, e.clientX, e.clientY)
            if (rel) onLassoPoint?.(rel.relX, rel.relY)
            return
          }
          if (cropActive && kind === "image" && cropStartRef.current) {
            const rel = relFromEvent(e.currentTarget, e.clientX, e.clientY)
            if (!rel) return
            const start = cropStartRef.current
            const x = Math.min(start.relX, rel.relX)
            const y = Math.min(start.relY, rel.relY)
            const w = Math.abs(rel.relX - start.relX)
            const h = Math.abs(rel.relY - start.relY)
            setCropPreview({ x, y, w, h })
            onCropDrag?.(start, rel)
          }
        }}
        onPointerUp={(e) => {
          if (lassoActive && kind === "image") {
            onLassoComplete?.()
            return
          }
          if (cropActive && kind === "image" && cropStartRef.current) {
            const rel = relFromEvent(e.currentTarget, e.clientX, e.clientY)
            if (rel) onCropComplete?.(cropStartRef.current, rel)
            cropStartRef.current = null
            setCropPreview(null)
          }
        }}
        onTouchStart={(e) => {
          if (isHandleTarget(e.target)) return
          if (toolModeActive) return
          e.stopPropagation()
          beginTouchDrag(e, "move")
        }}
      >
        {children}

        {cropPreview && cropPreview.w > 0.01 && cropPreview.h > 0.01 ? (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-amber-400 bg-amber-400/15"
            style={{
              left: `${cropPreview.x * 100}%`,
              top: `${cropPreview.y * 100}%`,
              width: `${cropPreview.w * 100}%`,
              height: `${cropPreview.h * 100}%`,
            }}
            aria-hidden
            {...{ [CAPTURE_HIDE_ATTR]: "true" }}
          />
        ) : null}

        {showChrome && (
          <>
            <div
              className="pointer-events-none absolute inset-0 rounded-sm border border-dashed border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
              aria-hidden
              {...{ [CAPTURE_HIDE_ATTR]: "true" }}
            />

            <div
              {...{ [CAPTURE_HIDE_ATTR]: "true" }}
              className="pointer-events-none absolute inset-0"
            >
              <button
                type="button"
                data-handle="tool-delete"
                aria-label="Löschen"
                className={cn(
                  "pointer-events-auto absolute -left-3 -top-3 z-40 flex h-7 w-7 items-center justify-center rounded-full",
                  "border border-red-400/60 bg-background text-red-500 shadow-md hover:bg-red-500/15",
                  CANVAS_TOUCH_LOCK_CLASS
                )}
                style={CANVAS_TOUCH_LOCK_STYLE}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.()
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              {/* Rotation oben rechts (Word-Stil) */}
              <button
                type="button"
                data-handle="rotate"
                aria-label="Drehen"
                className={cn(
                  "pointer-events-auto absolute -right-3 -top-8 z-40 flex h-7 w-7 items-center justify-center rounded-full",
                  "border-2 border-cyan-400 bg-background text-cyan-500 shadow-md hover:bg-cyan-500/20",
                  CANVAS_TOUCH_LOCK_CLASS
                )}
                style={CANVAS_TOUCH_LOCK_STYLE}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  beginPointerDrag(e, "rotate")
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  onRotateStep?.()
                }}
                onTouchStart={(e) => {
                  e.stopPropagation()
                  beginTouchDrag(e, "rotate")
                }}
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                data-handle="tool-layers-back"
                aria-label="Nach hinten senden"
                className={cn(
                  "pointer-events-auto absolute -bottom-3 -left-10 z-40 flex h-7 w-7 items-center justify-center rounded-full",
                  "border border-cyan-400/60 bg-background text-cyan-500 shadow-md hover:bg-cyan-500/15",
                  CANVAS_TOUCH_LOCK_CLASS
                )}
                style={CANVAS_TOUCH_LOCK_STYLE}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onSendBackward?.()
                }}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                data-handle="tool-layers"
                aria-label="Nach vorne bringen"
                className={cn(
                  "pointer-events-auto absolute -bottom-3 -left-3 z-40 flex h-7 w-7 items-center justify-center rounded-full",
                  "border border-cyan-400/60 bg-background text-cyan-500 shadow-md hover:bg-cyan-500/15",
                  CANVAS_TOUCH_LOCK_CLASS
                )}
                style={CANVAS_TOUCH_LOCK_STYLE}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onBringForward?.()
                }}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>

              {RESIZE_HANDLES.map((handle) => (
                <button
                  key={handle}
                  type="button"
                  data-handle={`resize-${handle}`}
                  aria-label={`Grösse ändern (${handle})`}
                  className={cn(
                    "pointer-events-auto absolute z-40 h-3.5 w-3.5 rounded-sm border-2 border-cyan-400 bg-cyan-400 shadow-md hover:scale-110",
                    resizeHandleClass(handle),
                    CANVAS_TOUCH_LOCK_CLASS
                  )}
                  style={CANVAS_TOUCH_LOCK_STYLE}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    beginPointerDrag(e, "resize", {
                      resizeHandle: handle,
                      proportional: Boolean(proportionalScale),
                    })
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    beginTouchDrag(e, "resize", {
                      resizeHandle: handle,
                      proportional: Boolean(proportionalScale),
                    })
                  }}
                />
              ))}
            </div>

            <div
              {...{ [CAPTURE_HIDE_ATTR]: "true" }}
              className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 flex -translate-x-1/2 gap-1"
            >
              <button
                type="button"
                data-handle="tool-scale-down"
                aria-label="Verkleinern"
                className={cn(
                  "pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md border border-cyan-500/40 bg-background text-xs font-bold text-cyan-500 shadow",
                  CANVAS_TOUCH_LOCK_CLASS
                )}
                style={CANVAS_TOUCH_LOCK_STYLE}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onScaleStep?.(-0.1)
                }}
              >
                −
              </button>
              <button
                type="button"
                data-handle="tool-scale-up"
                aria-label="Vergrössern"
                className={cn(
                  "pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md border border-cyan-500/40 bg-background text-xs font-bold text-cyan-500 shadow",
                  CANVAS_TOUCH_LOCK_CLASS
                )}
                style={CANVAS_TOUCH_LOCK_STYLE}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onScaleStep?.(0.1)
                }}
              >
                +
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ElementTransformControls({
  label,
  layout,
  onChange,
  sizeMm,
  workAreaMm,
  maxScale,
  onFitToBounds,
  onDelete,
}: {
  label: string
  layout: ElementLayout
  onChange: (patch: Partial<ElementLayout>) => void
  sizeMm: ElementMmSize | null
  workAreaMm: WorkAreaMm
  maxScale: number
  onFitToBounds?: () => void
  onDelete?: () => void
}) {
  const usable = ENGRAVING_FRAME_USABLE_FRACTION
  const maxWidthMm = workAreaMm.widthMm * usable
  const maxHeightMm = workAreaMm.heightMm * usable
  const sliderMax = Math.max(maxScale, MIN_LAYOUT_SCALE)

  const applyWidthMm = (value: number) => {
    if (!sizeMm || sizeMm.widthMm <= 0) return
    const next = scaleForTargetWidthMm(
      layout.scale,
      sizeMm.widthMm,
      value,
      maxWidthMm,
      sliderMax
    )
    onChange({
      scale: next,
      scaleX: next,
      scaleY: next,
    })
  }

  const applyHeightMm = (value: number) => {
    if (!sizeMm || sizeMm.heightMm <= 0) return
    const next = scaleForTargetHeightMm(
      layout.scale,
      sizeMm.heightMm,
      value,
      maxHeightMm,
      sliderMax
    )
    onChange({
      scale: next,
      scaleX: next,
      scaleY: next,
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
      <p className="text-sm font-semibold text-cyan-400">{label} bearbeiten</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Breite (mm)</Label>
          <Input
            type="number"
            min={1}
            max={maxWidthMm}
            step={0.1}
            value={sizeMm ? Number(sizeMm.widthMm.toFixed(1)) : ""}
            disabled={!sizeMm}
            onChange={(e) => applyWidthMm(Number(e.target.value))}
            className="h-9 tabular-nums"
            aria-label="Gravur-Breite in Millimetern"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Höhe (mm)</Label>
          <Input
            type="number"
            min={1}
            max={maxHeightMm}
            step={0.1}
            value={sizeMm ? Number(sizeMm.heightMm.toFixed(1)) : ""}
            disabled={!sizeMm}
            onChange={(e) => applyHeightMm(Number(e.target.value))}
            className="h-9 tabular-nums"
            aria-label="Gravur-Höhe in Millimetern"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <Label>Grösse (Skalierung)</Label>
          <span className="font-mono text-muted-foreground">
            {layout.scale.toFixed(2)}x / max {sliderMax.toFixed(2)}x
          </span>
        </div>
        <input
          type="range"
          min={MIN_LAYOUT_SCALE}
          max={sliderMax}
          step={0.05}
          value={Math.min(layout.scale, sliderMax)}
          onChange={(e) => {
            const next = clampScale(Number(e.target.value), sliderMax)
            onChange({ scale: next, scaleX: next, scaleY: next })
          }}
          className="h-2 w-full cursor-pointer accent-cyan-500"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <Label>Rotation</Label>
          <span className="font-mono text-muted-foreground">
            {Math.round(layout.rotation)}°
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={layout.rotation}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer accent-cyan-500"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
          onClick={() => {
            const next = clampScale(layout.scale - 0.1, sliderMax)
            onChange({
              scale: next,
              scaleX: next,
              scaleY: next,
            })
          }}
        >
          Kleiner
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
          onClick={() => {
            const next = clampScale(layout.scale + 0.1, sliderMax)
            onChange({
              scale: next,
              scaleX: next,
              scaleY: next,
            })
          }}
        >
          Grösser
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => onChange({ rotation: (layout.rotation + 15) % 360 })}
        >
          +15°
        </Button>
        {onFitToBounds && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1 border-cyan-500/40 text-xs text-cyan-400"
            onClick={onFitToBounds}
          >
            <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
            An Feld anpassen
          </Button>
        )}
        {onDelete && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Löschen
          </Button>
        )}
      </div>
    </div>
  )
}

/** Emit layers + compat fields so shop/individual pages stay in sync. */
function buildLayersPatch(
  layers: LaserDesignLayer[],
  activeLayerId: string | null | undefined,
  fallbackFont: LaserFontId
): Partial<LaserDesignerState> {
  const compat = deriveCompatFromLayers(layers, fallbackFont)
  const patch: Partial<LaserDesignerState> = {
    layers,
    ...compat,
  }
  if (activeLayerId !== undefined) {
    patch.activeLayerId = activeLayerId
  }
  return patch
}

function LaserDesignerSettings({
  material,
  productName,
  state,
  onStateChange,
  showMaterialCard = true,
  showVariantPicker = true,
  showTextLayers = true,
  varianten = [],
}: LaserDesignerBaseProps & {
  showMaterialCard?: boolean
  showVariantPicker?: boolean
  showTextLayers?: boolean
  varianten?: string[]
}) {
  const { selectedVariant, selectedFont, layers, activeLayerId } = state
  const hasVarianten = varianten.length > 0
  const textLayers = layers.filter((l) => l.kind === "text")

  const emitLayers = useCallback(
    (nextLayers: LaserDesignLayer[], nextActive?: string | null) => {
      onStateChange(
        buildLayersPatch(
          nextLayers,
          nextActive !== undefined ? nextActive : activeLayerId,
          selectedFont
        )
      )
    },
    [onStateChange, activeLayerId, selectedFont]
  )

  // Migrate legacy compat → layers once if needed
  useEffect(() => {
    const ensured = ensureLaserLayers(state)
    const missing =
      !Array.isArray(state.layers) ||
      (state.layers.length === 0 &&
        (Boolean(state.engravingText?.trim()) || Boolean(state.imageLayout?.src)))
    if (missing && ensured.length > 0) {
      onStateChange(
        buildLayersPatch(ensured, state.activeLayerId ?? ensured[0]?.id ?? null, selectedFont)
      )
    }
    // Nur einmal beim Mount / wenn Layers fehlen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setVariant = (variant: string) => onStateChange({ selectedVariant: variant })

  const updateTextLayer = (id: string, patch: Partial<LaserDesignLayer>) => {
    const next = updateLayerById(layers, id, patch)
    emitLayers(next, id)
  }

  const addTextLayer = () => {
    const offset = nextLayerOffset(layers.length)
    const layer = createTextLayer({
      text: "",
      fontId: selectedFont,
      ...offset,
    })
    emitLayers([...layers, layer], layer.id)
  }

  useEffect(() => {
    if (!hasVarianten) return
    if (!varianten.includes(selectedVariant)) {
      onStateChange({ selectedVariant: varianten[0] })
    }
  }, [hasVarianten, varianten, selectedVariant, onStateChange])

  return (
    <div className="space-y-6">
      {showMaterialCard && (
        <Card className="overflow-hidden rounded-xl border-cyan-500/25 bg-gradient-to-br from-card/90 via-card/50 to-cyan-500/5 shadow-lg shadow-cyan-500/5">
          <CardContent className="p-0">
            <div className="border-b border-border/50 bg-cyan-500/5 px-4 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-500">
                Wunsch-Material · {productName}
              </p>
            </div>
            <div className="grid gap-3 p-3 sm:grid-cols-[auto_1fr]">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-lg text-2xl shadow-inner",
                  material.iconBg
                )}
              >
                {material.icon}
              </div>
              <div>
                <h3 className={cn("text-base font-bold", material.iconColor)}>
                  {material.name}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {material.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <FeatureTag label="Gravur erlaubt" allowed={material.canEngrave} />
                  <FeatureTag label="Schnitt erlaubt" allowed={material.canCut} />
                  {material.maxThickness && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <Scissors className="h-3 w-3 text-cyan-500" />
                      Max. Dicke: {material.maxThickness}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showVariantPicker && hasVarianten && (
        <Card className="rounded-xl border-border/50 bg-card/50">
          <CardContent className="p-3">
            <div className="mb-2 flex items-center gap-2">
              <Stamp className="h-3.5 w-3.5 text-cyan-400" />
              <h3 className="text-sm font-bold">Variante wählen</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {varianten.map((varianteStichwort) => {
                const isSelected = selectedVariant === varianteStichwort
                return (
                  <button
                    key={varianteStichwort}
                    type="button"
                    onClick={() => setVariant(varianteStichwort)}
                    className={cn(
                      "relative rounded-lg border px-2 py-1.5 text-center transition-all duration-200",
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/10 shadow-sm shadow-cyan-500/15"
                        : "border-border/60 bg-background/40 hover:border-cyan-500/40 hover:bg-cyan-500/5"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        isSelected ? "text-cyan-400" : "text-foreground"
                      )}
                    >
                      {varianteStichwort}
                    </span>
                    {isSelected && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500">
                        <CheckCircle2 className="h-2.5 w-2.5 text-background" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {showTextLayers && (
      <Card className="rounded-xl border-border/50 bg-card/50">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-cyan-400" />
              <h3 className="font-bold">Text-Layer</h3>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-cyan-500/40 text-xs text-cyan-400"
              onClick={addTextLayer}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Weiteren Text hinzufügen
            </Button>
          </div>

          {textLayers.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Noch kein Text. Füge einen Text-Layer hinzu oder tippe unten.
            </p>
          )}

          {textLayers.map((layer, index) => {
            const fontId = layer.fontId ?? selectedFont
            const inputFontStyle = {
              ...getLaserFontInputStyle(fontId),
              fontFamily: getLaserFontFamily(fontId),
            }
            const isActive = activeLayerId === layer.id
            return (
              <div
                key={layer.id}
                className={cn(
                  "space-y-3 rounded-lg border p-4 transition-colors",
                  isActive
                    ? "border-cyan-500/50 bg-cyan-500/5"
                    : "border-border/50 bg-background/40"
                )}
                onClick={() => onStateChange({ activeLayerId: layer.id })}
              >
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-semibold">
                    Text {index + 1}
                  </Label>
                  {textLayers.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        const next = removeLayerById(layers, layer.id)
                        emitLayers(
                          next,
                          activeLayerId === layer.id
                            ? next[0]?.id ?? null
                            : activeLayerId
                        )
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <Textarea
                  value={layer.text ?? ""}
                  onChange={(e) =>
                    updateTextLayer(layer.id, { text: e.target.value })
                  }
                  onFocus={() => onStateChange({ activeLayerId: layer.id })}
                  placeholder="z.B. Firmenname, Datum, Widmung..."
                  rows={3}
                  style={inputFontStyle}
                  className={cn(
                    "resize-none rounded-lg border-cyan-500/25 bg-background/60 text-sm",
                    "placeholder:text-muted-foreground/70 placeholder:font-[inherit]",
                    "shadow-[0_0_20px_-8px] shadow-cyan-500/20",
                    "focus-visible:border-cyan-500/50 focus-visible:ring-2 focus-visible:ring-cyan-500/25"
                  )}
                />

                <div className="space-y-1.5">
                  <Label className="text-xs">Schriftart</Label>
                  <div className="relative">
                    <select
                      value={fontId}
                      onChange={(e) => {
                        const nextFont = e.target.value as LaserFontId
                        updateTextLayer(layer.id, { fontId: nextFont })
                        // Primärer Text setzt auch selectedFont (Compat)
                        if (index === 0) {
                          onStateChange({ selectedFont: nextFont })
                        }
                      }}
                      onFocus={() => onStateChange({ activeLayerId: layer.id })}
                      style={getLaserFontDropdownStyle(fontId)}
                      className={cn(
                        "w-full appearance-none rounded-lg border border-border/70 bg-card/90 py-2.5 pl-4 pr-10 text-sm text-foreground",
                        "shadow-[0_0_24px_-12px] shadow-cyan-500/30",
                        "transition-all duration-200",
                        "hover:border-cyan-500/35",
                        "focus:border-cyan-500/55 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                      )}
                    >
                      {LASER_FONT_OPTIONS.map((font) => (
                        <option
                          key={font.id}
                          value={font.id}
                          style={getLaserFontDropdownStyle(font.id)}
                        >
                          {font.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500/80"
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
            )
          })}

          {textLayers.length === 0 && (
            <Button
              type="button"
              className="w-full border-cyan-500/40 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
              variant="outline"
              onClick={addTextLayer}
            >
              <Plus className="mr-2 h-4 w-4" />
              Text hinzufügen
            </Button>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  )
}

function LaserDesignerPreview({
  material,
  state,
  onStateChange,
  workAreaMm = DEFAULT_WORK_AREA_MM,
  onEngravingMetricsChange,
  previewSurfaceRef,
  customizationBackgroundUrl,
}: Omit<LaserDesignerBaseProps, "productName"> & {
  workAreaMm?: WorkAreaMm
  onEngravingMetricsChange?: (metrics: LaserEngravingMetrics) => void
  previewSurfaceRef?: RefObject<HTMLDivElement | null>
  customizationBackgroundUrl?: string
}) {
  const { selectedFont, layers, activeLayerId } = state
  const canvasRef = useRef<HTMLDivElement>(null)
  const layerInnerRefs = useRef<Map<string, HTMLElement>>(new Map())
  const dragSessionRef = useRef<DragSession | null>(null)
  const [dragMode, setDragMode] = useState<DragMode | null>(null)
  const [liveMmLabel, setLiveMmLabel] = useState<ElementMmSize | null>(null)
  const [layerMmMap, setLayerMmMap] = useState<Record<string, ElementMmSize>>({})
  const [maxScaleMap, setMaxScaleMap] = useState<Record<string, number>>({})
  const [removingBg, setRemovingBg] = useState(false)
  const [eyedropperActive, setEyedropperActive] = useState(false)
  const [eyedropperTolerance, setEyedropperTolerance] = useState(40)
  const [eyedropperColor, setEyedropperColor] = useState<RgbColor | null>(null)
  const [eyedropperBaseSrc, setEyedropperBaseSrc] = useState<string | null>(
    null
  )
  const [eyedropperLayerId, setEyedropperLayerId] = useState<string | null>(
    null
  )
  const [eraserActive, setEraserActive] = useState(false)
  const [lassoActive, setLassoActive] = useState(false)
  const [cropActive, setCropActive] = useState(false)
  const [proportionalScale, setProportionalScale] = useState(true)
  const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(
    null
  )
  const [eraserRadius, setEraserRadius] = useState(0.045)
  const [undoStack, setUndoStack] = useState<
    Array<{ layerId: string; src: string }>
  >([])
  const eraserBusyRef = useRef(false)
  const eraserSrcRef = useRef<string | null>(null)
  const lastBrushPointRef = useRef<{ relX: number; relY: number } | null>(null)
  const lassoPointsRef = useRef<Array<{ relX: number; relY: number }>>([])
  const lassoBusyRef = useRef(false)
  const canvasStyle = getMaterialCanvasStyle(material.id)
  const workAreaLabel = `${workAreaMm.widthMm} x ${workAreaMm.heightMm} mm`

  const stateRef = useRef(state)
  stateRef.current = state

  const emitLayers = useCallback(
    (nextLayers: LaserDesignLayer[], nextActive?: string | null) => {
      const current = stateRef.current
      onStateChange(
        buildLayersPatch(
          nextLayers,
          nextActive !== undefined ? nextActive : current.activeLayerId,
          current.selectedFont
        )
      )
    },
    [onStateChange]
  )

  // Migrate legacy compat → layers once
  useEffect(() => {
    const current = stateRef.current
    const ensured = ensureLaserLayers(current)
    const missing =
      !Array.isArray(current.layers) ||
      (current.layers.length === 0 &&
        (Boolean(current.engravingText?.trim()) ||
          Boolean(current.imageLayout?.src)))
    if (missing && ensured.length > 0) {
      onStateChange(
        buildLayersPatch(
          ensured,
          current.activeLayerId ?? ensured[0]?.id ?? null,
          current.selectedFont
        )
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleTextLayers = layers.filter(
    (l) => l.kind === "text" && (l.text ?? "").trim().length > 0
  )
  const visibleImageLayers = layers.filter(
    (l) => l.kind === "image" && Boolean(l.src)
  )
  const hasAnyContent =
    visibleTextLayers.length > 0 ||
    visibleImageLayers.length > 0 ||
    Boolean(
      activeLayerId &&
        layers.some(
          (l) =>
            l.id === activeLayerId &&
            (l.kind === "image"
              ? Boolean(l.src)
              : true)
        )
    )

  const activeLayer =
    layers.find((l) => l.id === activeLayerId) ??
    visibleTextLayers[0] ??
    visibleImageLayers[0] ??
    null

  const imageLayersWithSrc = layers.filter(
    (l) => l.kind === "image" && Boolean(l.src)
  )
  const activeImageLayer =
    activeLayer?.kind === "image" && activeLayer.src
      ? activeLayer
      : imageLayersWithSrc.length === 1
        ? imageLayersWithSrc[0]
        : null

  const setLayerInnerRef = (id: string, el: HTMLElement | null) => {
    if (el) layerInnerRefs.current.set(id, el)
    else layerInnerRefs.current.delete(id)
  }

  const patchLayerLayout = (layerId: string, patch: Partial<ElementLayout>) => {
    const canvas = canvasRef.current
    const current = stateRef.current
    const layer = current.layers.find((l) => l.id === layerId)
    if (!layer) return

    const layout = layerToElementLayout(layer)
    const next: ElementLayout = { ...layout, ...patch }
    const innerEl = layerInnerRefs.current.get(layerId) ?? null

    if (patch.scale !== undefined && canvas && innerEl) {
      next.scale = clampLayoutScaleToFit(canvas, innerEl, layout, patch.scale)
      if (patch.scaleX === undefined && patch.scaleY === undefined) {
        next.scaleX = next.scale
        next.scaleY = next.scale
      }
    }
    if (patch.scaleX !== undefined || patch.scaleY !== undefined) {
      const { sx, sy } = resolvedScaleXY(next)
      next.scaleX = sx
      next.scaleY = sy
      next.scale = (sx + sy) / 2
    }
    if ((patch.x !== undefined || patch.y !== undefined) && canvas) {
      const clamped = clampLayoutPosition(canvas, innerEl, next.x, next.y)
      next.x = clamped.x
      next.y = clamped.y
    }

    const nextLayers = updateLayerById(current.layers, layerId, next)
    emitLayers(nextLayers, layerId)
  }

  const applyLayout = useCallback(
    (layerId: string, patch: Partial<ElementLayout>) => {
      const current = stateRef.current
      const layer = current.layers.find((l) => l.id === layerId)
      if (!layer) return
      const nextLayers = updateLayerById(current.layers, layerId, {
        ...layerToElementLayout(layer),
        ...patch,
      })
      emitLayers(nextLayers, layerId)
    },
    [emitLayers]
  )

  const updateMetrics = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const current = stateRef.current
    const mmById: Record<string, ElementMmSize> = {}
    const maxById: Record<string, number> = {}

    for (const layer of current.layers) {
      const el = layerInnerRefs.current.get(layer.id)
      if (!el) continue
      const isVisible =
        (layer.kind === "text" && (layer.text ?? "").trim().length > 0) ||
        (layer.kind === "image" && Boolean(layer.src))
      if (!isVisible) continue

      const layout = layerToElementLayout(layer)
      mmById[layer.id] = measureElementMm(canvas, el, workAreaMm)
      maxById[layer.id] = computeMaxScaleToFitBounds(
        canvas,
        el,
        layout,
        ENGRAVING_FRAME_USABLE_FRACTION
      )
    }

    const primaryText = current.layers.find(
      (l) => l.kind === "text" && (l.text ?? "").trim()
    )
    const primaryImage = current.layers.find(
      (l) => l.kind === "image" && l.src
    )

    const textSize = primaryText ? mmById[primaryText.id] ?? null : null
    const imageSize = primaryImage ? mmById[primaryImage.id] ?? null : null

    const activeId = current.activeLayerId
    const active =
      (activeId && mmById[activeId]) ||
      textSize ||
      imageSize ||
      null

    const maxAreaMm2 = Math.max(
      0,
      ...Object.values(mmById).map((m) => m.areaMm2)
    )

    setLayerMmMap(mmById)
    setMaxScaleMap(maxById)
    setLiveMmLabel(active)
    onEngravingMetricsChange?.({
      text: textSize,
      image: imageSize,
      active,
      maxAreaMm2,
    })
  }, [onEngravingMetricsChange, workAreaMm])

  useLayoutEffect(() => {
    updateMetrics()
  }, [updateMetrics, layers, activeLayerId, selectedFont, workAreaMm])

  const processDragMove = useCallback(
    (clientX: number, clientY: number, pointerId?: number) => {
      const session = dragSessionRef.current
      if (!session) return
      if (pointerId !== undefined && session.pointerId !== pointerId) return

      const canvas = canvasRef.current
      if (!canvas) return

      const { startLayout, mode, target } = session
      const pad = 2

      if (mode === "move") {
        const start = getCanvasPoint(
          canvas,
          session.startClientX,
          session.startClientY
        )
        const now = getCanvasPoint(canvas, clientX, clientY)
        const rawX = startLayout.x + (now.percentX - start.percentX)
        const rawY = startLayout.y + (now.percentY - start.percentY)
        const halfW = session.halfWPercent
        const halfH = session.halfHPercent
        applyLayout(target, {
          x: Math.max(halfW + pad, Math.min(100 - halfW - pad, rawX)),
          y: Math.max(halfH + pad, Math.min(100 - halfH - pad, rawY)),
        })
        return
      }

      if (mode === "resize") {
        const handle = session.resizeHandle ?? "se"
        const scales = computeResizeScales({
          handle,
          startLayout,
          centerClientX: session.centerClientX,
          centerClientY: session.centerClientY,
          startClientX: session.startClientX,
          startClientY: session.startClientY,
          clientX,
          clientY,
          startDistance: session.startDistance,
          proportional: session.proportional ?? true,
          maxScale: session.maxScale,
        })
        applyLayout(target, {
          scale: scales.scale,
          scaleX: scales.scaleX,
          scaleY: scales.scaleY,
        })
        return
      }

      if (mode === "rotate") {
        const angle = pointerAngleDegrees(
          session.centerClientX,
          session.centerClientY,
          clientX,
          clientY
        )
        const delta = angle - session.startPointerAngle
        const rotation = normalizeRotation(startLayout.rotation + delta)
        applyLayout(target, { rotation })
      }
    },
    [applyLayout]
  )

  const endDragSession = useCallback((pointerId?: number) => {
    const session = dragSessionRef.current
    if (!session) return
    if (pointerId !== undefined && session.pointerId !== pointerId) return
    dragSessionRef.current = null
    setDragMode(null)
    try {
      if (pointerId !== undefined) {
        canvasRef.current?.releasePointerCapture(pointerId)
      }
    } catch {
      // Capture kann bereits geloest sein
    }
  }, [])

  // Window-Listener: Drag bleibt aktiv auch ausserhalb des Canvas (rAF für Stabilität).
  useEffect(() => {
    const pendingRef: {
      current: { clientX: number; clientY: number; pointerId: number } | null
    } = { current: null }
    let rafId: number | null = null

    const flush = () => {
      rafId = null
      const pending = pendingRef.current
      if (!pending) return
      processDragMove(pending.clientX, pending.clientY, pending.pointerId)
    }

    const schedule = (clientX: number, clientY: number, pointerId: number) => {
      pendingRef.current = { clientX, clientY, pointerId }
      if (rafId != null) return
      rafId = requestAnimationFrame(flush)
    }

    const onPointerMove = (e: PointerEvent) => {
      const session = dragSessionRef.current
      if (!session || session.pointerId !== e.pointerId) return
      e.preventDefault()
      schedule(e.clientX, e.clientY, e.pointerId)
    }

    const onPointerUp = (e: PointerEvent) => {
      endDragSession(e.pointerId)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!dragSessionRef.current) return
      e.preventDefault()
      const touch = e.touches[0]
      if (!touch) return
      if (typeof window !== "undefined" && "PointerEvent" in window) return
      schedule(touch.clientX, touch.clientY, touch.identifier)
    }

    const onTouchEnd = (e: TouchEvent) => {
      const session = dragSessionRef.current
      if (!session) return
      const ended = Array.from(e.changedTouches).some(
        (t) => t.identifier === session.pointerId
      )
      if (ended || e.touches.length === 0) {
        endDragSession(session.pointerId)
      }
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false })
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
    window.addEventListener("touchmove", onTouchMove, { passive: false })
    window.addEventListener("touchend", onTouchEnd)
    window.addEventListener("touchcancel", onTouchEnd)

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
      window.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [endDragSession, processDragMove])

  const startDragSession = useCallback((session: DragSession) => {
    dragSessionRef.current = session
    onStateChange({ activeLayerId: session.target })
    setDragMode(session.mode)
  }, [onStateChange])

  const assignPreviewSurfaceRef = useCallback(
    (node: HTMLDivElement | null) => {
      canvasRef.current = node
      if (previewSurfaceRef) {
        previewSurfaceRef.current = node
      }
    },
    [previewSurfaceRef]
  )

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const src = (event.target?.result as string) ?? null
      if (!src) return
      const current = stateRef.current
      const offset = nextLayerOffset(current.layers.length)
      const layer = createImageLayer({ src, ...offset })
      emitLayers([...current.layers, layer], layer.id)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const pushImageUndo = useCallback((layerId: string, src: string) => {
    setUndoStack((prev) => [...prev.slice(-19), { layerId, src }])
  }, [])

  const clearPipetteLiveChain = useCallback(() => {
    setEyedropperColor(null)
    setEyedropperBaseSrc(null)
    setEyedropperLayerId(null)
  }, [])

  const deactivateImageTools = useCallback(
    (except?: "eyedropper" | "eraser" | "lasso" | "crop") => {
      if (except !== "eyedropper") setEyedropperActive(false)
      if (except !== "eraser") setEraserActive(false)
      if (except !== "lasso") setLassoActive(false)
      if (except !== "crop") setCropActive(false)
    },
    []
  )

  const handleUndoImageEdit = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      const next = prev.slice(0, -1)
      // Pipette-Live-Kette stoppen, sonst überschreibt der Effect das Undo
      clearPipetteLiveChain()
      const layersNow = updateLayerById(stateRef.current.layers, last.layerId, {
        src: last.src,
      })
      emitLayers(layersNow, last.layerId)
      return next
    })
  }, [clearPipetteLiveChain, emitLayers])

  const handleRemoveBackground = async () => {
    if (!activeImageLayer?.src || removingBg) return
    setRemovingBg(true)
    deactivateImageTools()
    try {
      pushImageUndo(activeImageLayer.id, activeImageLayer.src)
      const nextSrc = await removeLightImageBackground(activeImageLayer.src)
      const next = updateLayerById(stateRef.current.layers, activeImageLayer.id, {
        src: nextSrc,
      })
      emitLayers(next, activeImageLayer.id)
      clearPipetteLiveChain()
    } catch (err) {
      console.warn("Hintergrund entfernen fehlgeschlagen:", err)
    } finally {
      setRemovingBg(false)
    }
  }

  const applyEyedropperFilter = useCallback(
    async (
      layerId: string,
      baseSrc: string,
      color: RgbColor,
      tolerance: number
    ) => {
      const nextSrc = await removeColorNearBackground(baseSrc, color, tolerance)
      const next = updateLayerById(stateRef.current.layers, layerId, {
        src: nextSrc,
      })
      emitLayers(next, layerId)
    },
    [emitLayers]
  )

  const handleEyedropperSample = async (
    relX: number,
    relY: number,
    layerId: string
  ) => {
    if (removingBg) return
    const targetLayer = stateRef.current.layers.find(
      (l) => l.id === layerId && l.kind === "image" && l.src
    )
    if (!targetLayer?.src) return
    setRemovingBg(true)
    onStateChange({ activeLayerId: layerId })
    try {
      // Kumulativ: aktuelle Layer-Src (bereits maskiert) ist Basis für neue Farbe
      const baseSrc = targetLayer.src
      const color = await sampleImageColorAt(baseSrc, relX, relY)
      pushImageUndo(targetLayer.id, targetLayer.src)
      setEyedropperColor(color)
      setEyedropperBaseSrc(baseSrc)
      setEyedropperLayerId(targetLayer.id)
      await applyEyedropperFilter(
        targetLayer.id,
        baseSrc,
        color,
        eyedropperTolerance
      )
    } catch (err) {
      console.warn("Pipette-Hintergrund entfernen fehlgeschlagen:", err)
    } finally {
      setRemovingBg(false)
    }
  }

  // Live-Toleranz: gespeicherte Farbe neu anwenden (ohne removingBg-Deps → kein Loop)
  useEffect(() => {
    if (!eyedropperColor || !eyedropperBaseSrc || !eyedropperLayerId) {
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          if (cancelled) return
          await applyEyedropperFilter(
            eyedropperLayerId,
            eyedropperBaseSrc,
            eyedropperColor,
            eyedropperTolerance
          )
        } catch (err) {
          console.warn("Toleranz-Update fehlgeschlagen:", err)
        }
      })()
    }, 60)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [
    eyedropperTolerance,
    eyedropperColor,
    eyedropperBaseSrc,
    eyedropperLayerId,
    applyEyedropperFilter,
  ])

  const handleEraserPaint = async (relX: number, relY: number) => {
    const layerId = activeImageLayer?.id
    if (!layerId || eraserBusyRef.current) return
    const current = eraserSrcRef.current ?? activeImageLayer?.src
    if (!current || !eraserActive) return
    eraserBusyRef.current = true
    try {
      const from = lastBrushPointRef.current ?? { relX, relY }
      const strokePoints = interpolateBrushPoints(from, { relX, relY }, eraserRadius)
      lastBrushPointRef.current = { relX, relY }
      const nextSrc = await eraseImageBrushStroke(current, strokePoints)
      eraserSrcRef.current = nextSrc
      const next = updateLayerById(stateRef.current.layers, layerId, {
        src: nextSrc,
      })
      emitLayers(next, layerId)
    } catch (err) {
      console.warn("Radierer fehlgeschlagen:", err)
    } finally {
      eraserBusyRef.current = false
    }
  }

  const eraserStrokeStartedRef = useRef(false)

  const handleEraserPaintSafe = (relX: number, relY: number) => {
    if (!activeImageLayer?.src) return
    if (eyedropperColor) clearPipetteLiveChain()
    if (!eraserStrokeStartedRef.current) {
      pushImageUndo(activeImageLayer.id, activeImageLayer.src)
      eraserStrokeStartedRef.current = true
      lastBrushPointRef.current = null
      eraserSrcRef.current = activeImageLayer.src
    }
    void handleEraserPaint(relX, relY)
  }

  const handleLassoPoint = (relX: number, relY: number) => {
    if (!activeImageLayer?.src) return
    if (eyedropperColor) clearPipetteLiveChain()
    if (lassoPointsRef.current.length === 0) {
      pushImageUndo(activeImageLayer.id, activeImageLayer.src)
    }
    const last = lassoPointsRef.current[lassoPointsRef.current.length - 1]
    if (
      last &&
      Math.hypot(last.relX - relX, last.relY - relY) < 0.004
    ) {
      return
    }
    lassoPointsRef.current.push({ relX, relY })
  }

  const handleLassoComplete = async () => {
    if (!activeImageLayer?.src || lassoBusyRef.current) return
    const points = lassoPointsRef.current
    lassoPointsRef.current = []
    if (points.length < 3) return
    lassoBusyRef.current = true
    try {
      const nextSrc = await eraseImageLassoRegion(activeImageLayer.src, points)
      const next = updateLayerById(stateRef.current.layers, activeImageLayer.id, {
        src: nextSrc,
      })
      emitLayers(next, activeImageLayer.id)
    } catch (err) {
      console.warn("Lasso fehlgeschlagen:", err)
    } finally {
      lassoBusyRef.current = false
    }
  }

  const handleCropComplete = async (
    start: { relX: number; relY: number },
    end: { relX: number; relY: number }
  ) => {
    if (!activeImageLayer?.src) return
    const x = Math.min(start.relX, end.relX)
    const y = Math.min(start.relY, end.relY)
    const w = Math.abs(end.relX - start.relX)
    const h = Math.abs(end.relY - start.relY)
    if (w < 0.04 || h < 0.04) return
    if (eyedropperColor) clearPipetteLiveChain()
    pushImageUndo(activeImageLayer.id, activeImageLayer.src)
    try {
      const nextSrc = await cropImageToRelRect(activeImageLayer.src, { x, y, w, h })
      const next = updateLayerById(stateRef.current.layers, activeImageLayer.id, {
        src: nextSrc,
      })
      emitLayers(next, activeImageLayer.id)
      setCropActive(false)
    } catch (err) {
      console.warn("Zuschneiden fehlgeschlagen:", err)
    }
  }

  useEffect(() => {
    if (!eraserActive) {
      eraserStrokeStartedRef.current = false
      lastBrushPointRef.current = null
      eraserSrcRef.current = null
    }
  }, [eraserActive])

  useEffect(() => {
    const onUp = () => {
      eraserStrokeStartedRef.current = false
      lastBrushPointRef.current = null
    }
    window.addEventListener("pointerup", onUp)
    return () => window.removeEventListener("pointerup", onUp)
  }, [])

  const bringLayerForward = (layerId: string) => {
    const current = stateRef.current.layers
    const idx = current.findIndex((l) => l.id === layerId)
    if (idx < 0 || idx >= current.length - 1) return
    const next = [...current]
    const [item] = next.splice(idx, 1)
    next.splice(idx + 1, 0, item)
    emitLayers(next, layerId)
  }

  const sendLayerBackward = (layerId: string) => {
    const current = stateRef.current.layers
    const idx = current.findIndex((l) => l.id === layerId)
    if (idx <= 0) return
    const next = [...current]
    const [item] = next.splice(idx, 1)
    next.splice(idx - 1, 0, item)
    emitLayers(next, layerId)
  }

  const addTextLayerFromPreview = () => {
    const current = stateRef.current
    const offset = nextLayerOffset(current.layers.length)
    const layer = createTextLayer({
      text: "Text",
      fontId: current.selectedFont,
      ...offset,
    })
    emitLayers([...current.layers, layer], layer.id)
  }

  const handleFitToBounds = (layerId: string) => {
    const canvas = canvasRef.current
    const el = layerInnerRefs.current.get(layerId)
    const layer = stateRef.current.layers.find((l) => l.id === layerId)
    if (!canvas || !el || !layer) return
    const layout = layerToElementLayout(layer)
    const scale = fitLayoutScaleToBounds(
      canvas,
      el,
      layout,
      ENGRAVING_FRAME_USABLE_FRACTION
    )
    patchLayerLayout(layerId, { scale })
  }

  const handleDeleteLayer = (layerId: string) => {
    const next = removeLayerById(stateRef.current.layers, layerId)
    emitLayers(
      next,
      activeLayerId === layerId ? next[0]?.id ?? null : activeLayerId
    )
  }

  const activeMaxScale =
    (activeLayer && maxScaleMap[activeLayer.id]) || FALLBACK_MAX_SCALE
  const activeSizeMm =
    (activeLayer && layerMmMap[activeLayer.id]) || null

  return (
    <Card className="relative isolate rounded-xl border-cyan-500/20 bg-card/50 shadow-lg shadow-cyan-500/5">
      <CardContent className="relative flex flex-col gap-0 p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            <h3 className="font-bold">Live-Vorschau</h3>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 border-cyan-500/30 text-cyan-500"
          >
            {workAreaLabel}
          </Badge>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          Innen ziehen = verschieben · Griff oben rechts = drehen · 8 Griffe =
          skalieren. Alles bleibt innerhalb von {workAreaLabel}.
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleImageUpload}
            />
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20">
              <Plus className="h-3.5 w-3.5" />
              Bild
            </span>
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-cyan-500/40 px-3 text-xs text-cyan-400"
            onClick={addTextLayerFromPreview}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Text
          </Button>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={proportionalScale}
              onCheckedChange={(v) => setProportionalScale(v === true)}
              aria-label="Proportional skalieren"
            />
            Proportional skalieren
          </label>
        </div>

        <div className="relative flex gap-2">
          {/* Kompakte Werkzeug-Leiste am Canvas-Rand */}
          <div
            className="flex shrink-0 flex-col gap-1.5"
            {...{ [CAPTURE_HIDE_ATTR]: "true" }}
          >
            <Button
              type="button"
              size="icon"
              variant={eyedropperActive ? "default" : "outline"}
              className={cn(
                "h-9 w-9",
                eyedropperActive && "bg-cyan-600 text-white hover:bg-cyan-500"
              )}
              title="Pipette / Farbe entfernen"
              disabled={removingBg || !activeImageLayer}
              onClick={() => {
                deactivateImageTools("eyedropper")
                setEyedropperActive((v) => !v)
              }}
            >
              <Pipette className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={eraserActive ? "default" : "outline"}
              className={cn(
                "h-9 w-9",
                eraserActive && "bg-cyan-600 text-white hover:bg-cyan-500"
              )}
              title="Radierer / Pinsel"
              disabled={!activeImageLayer}
              onClick={() => {
                deactivateImageTools("eraser")
                setEraserActive((v) => !v)
              }}
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={lassoActive ? "default" : "outline"}
              className={cn(
                "h-9 w-9",
                lassoActive && "bg-cyan-600 text-white hover:bg-cyan-500"
              )}
              title="Lasso freistellen"
              disabled={!activeImageLayer}
              onClick={() => {
                deactivateImageTools("lasso")
                lassoPointsRef.current = []
                setLassoActive((v) => !v)
              }}
            >
              <Lasso className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={cropActive ? "default" : "outline"}
              className={cn(
                "h-9 w-9",
                cropActive && "bg-cyan-600 text-white hover:bg-cyan-500"
              )}
              title="Bild zuschneiden"
              disabled={!activeImageLayer}
              onClick={() => {
                deactivateImageTools("crop")
                setCropActive((v) => !v)
              }}
            >
              <Crop className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              title="Weiss entfernen"
              disabled={removingBg || !activeImageLayer}
              onClick={() => void handleRemoveBackground()}
            >
              <Scissors className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              title="Zentrieren"
              disabled={!activeLayer}
              onClick={() => {
                if (!activeLayer) return
                patchLayerLayout(activeLayer.id, { x: 50, y: 50 })
                onStateChange({ activeLayerId: activeLayer.id })
              }}
            >
              <Crosshair className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              title="Rückgängig"
              disabled={undoStack.length === 0}
              onClick={handleUndoImageEdit}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              title="Nach vorne"
              disabled={!activeLayerId}
              onClick={() => activeLayerId && bringLayerForward(activeLayerId)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              title="Nach hinten"
              disabled={!activeLayerId}
              onClick={() => activeLayerId && sendLayerBackward(activeLayerId)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>

        <div
          ref={assignPreviewSurfaceRef}
          {...{ [LEITBILD_LASER_PREVIEW_ATTR]: "true" }}
          className={cn(
            "relative z-0 aspect-square min-w-0 flex-1 overflow-hidden rounded-xl border-2 border-cyan-500/25 shadow-inner",
            CANVAS_TOUCH_LOCK_CLASS,
            canvasStyle.surface
          )}
          style={CANVAS_TOUCH_LOCK_STYLE}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              onStateChange({ activeLayerId: null })
            }
          }}
        >
          {customizationBackgroundUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customizationBackgroundUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              crossOrigin="anonymous"
              draggable={false}
            />
          ) : null}
          <div
            className={cn(
              "pointer-events-none absolute inset-0",
              canvasStyle.overlay,
              customizationBackgroundUrl && "opacity-40"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-[6%] rounded-sm border border-dashed border-cyan-400/50",
            )}
            aria-hidden
            {...{ [CAPTURE_HIDE_ATTR]: "true" }}
          />
          <div
            className="pointer-events-none absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-20"
            {...{ [CAPTURE_HIDE_ATTR]: "true" }}
          >
            {Array.from({ length: 36 }).map((_, i) => (
              <div key={i} className="border border-white/10" />
            ))}
          </div>

          {layers.map((layer, index) => {
            const isActive = activeLayerId === layer.id
            if (layer.kind === "image" && layer.src) {
              return (
                <InteractiveCanvasElement
                  key={layer.id}
                  layerId={layer.id}
                  kind="image"
                  layout={layerToElementLayout(layer)}
                  isActive={isActive}
                  isMoving={dragMode != null && isActive}
                  stackIndex={index}
                  canvasRef={canvasRef}
                  onSelect={() => onStateChange({ activeLayerId: layer.id })}
                  onDragStart={startDragSession}
                  onInnerRef={(el) => setLayerInnerRef(layer.id, el)}
                  eyedropperActive={eyedropperActive}
                  eraserActive={eraserActive}
                  lassoActive={lassoActive}
                  cropActive={cropActive}
                  proportionalScale={proportionalScale}
                  onEyedropperSample={(relX, relY, id) => {
                    void handleEyedropperSample(relX, relY, id)
                  }}
                  onEraserPaint={handleEraserPaintSafe}
                  onLassoPoint={handleLassoPoint}
                  onLassoComplete={() => {
                    void handleLassoComplete()
                  }}
                  onCropComplete={(start, end) => {
                    void handleCropComplete(start, end)
                  }}
                  onDelete={() => handleDeleteLayer(layer.id)}
                  onRotateStep={() =>
                    patchLayerLayout(layer.id, {
                      rotation: normalizeRotation((layer.rotation ?? 0) + 15),
                    })
                  }
                  onScaleStep={(delta) => {
                    const max = maxScaleMap[layer.id] ?? FALLBACK_MAX_SCALE
                    const next = clampScale((layer.scale ?? 1) + delta, max)
                    patchLayerLayout(layer.id, {
                      scale: next,
                      scaleX: next,
                      scaleY: next,
                    })
                  }}
                  onBringForward={() => bringLayerForward(layer.id)}
                  onSendBackward={() => sendLayerBackward(layer.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={layer.src}
                    alt="Logo-Vorschau"
                    className={cn(
                      "max-h-32 w-auto rounded opacity-90 drop-shadow-lg grayscale",
                      CANVAS_TOUCH_LOCK_CLASS
                    )}
                    style={CANVAS_TOUCH_LOCK_STYLE}
                    draggable={false}
                    crossOrigin="anonymous"
                  />
                </InteractiveCanvasElement>
              )
            }

            if (layer.kind === "text") {
              const text = (layer.text ?? "").trim()
              // Leerer Text nur rendern wenn aktiv — damit Auswahl/Move funktioniert
              if (!text && !isActive) return null
              const fontId = layer.fontId ?? selectedFont
              const canvasFontStyle = getLaserFontStyle(fontId, "canvas")
              const fontFamily = getLaserFontFamily(fontId)
              return (
                <InteractiveCanvasElement
                  key={`${layer.id}-${fontId}`}
                  layerId={layer.id}
                  kind="text"
                  layout={layerToElementLayout(layer)}
                  isActive={isActive}
                  isMoving={dragMode != null && isActive}
                  stackIndex={index}
                  canvasRef={canvasRef}
                  onSelect={() => {
                    onStateChange({ activeLayerId: layer.id })
                  }}
                  onDragStart={startDragSession}
                  onInnerRef={(el) => setLayerInnerRef(layer.id, el)}
                  className="w-max max-w-none px-2 text-center text-white/90 drop-shadow-lg"
                  style={{
                    ...canvasFontStyle,
                    fontFamily,
                    fontSize:
                      canvasFontStyle.fontSize ??
                      "clamp(0.875rem, 3.5vw, 1.25rem)",
                    whiteSpace: "pre",
                    width: "max-content",
                    maxWidth: "none",
                    textShadow: "0 1px 8px rgba(0,0,0,0.8)",
                  }}
                  proportionalScale={proportionalScale}
                  onDelete={() => handleDeleteLayer(layer.id)}
                  onRotateStep={() =>
                    patchLayerLayout(layer.id, {
                      rotation: normalizeRotation((layer.rotation ?? 0) + 15),
                    })
                  }
                  onScaleStep={(delta) => {
                    const max = maxScaleMap[layer.id] ?? FALLBACK_MAX_SCALE
                    const next = clampScale((layer.scale ?? 1) + delta, max)
                    patchLayerLayout(layer.id, {
                      scale: next,
                      scaleX: next,
                      scaleY: next,
                    })
                  }}
                  onBringForward={() => bringLayerForward(layer.id)}
                  onSendBackward={() => sendLayerBackward(layer.id)}
                  onEditText={() => {
                    onStateChange({ activeLayerId: layer.id })
                    setEditingTextLayerId(layer.id)
                  }}
                >
                  {text || "Text"}
                </InteractiveCanvasElement>
              )
            }

            return null
          })}

          {!hasAnyContent && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-muted-foreground">
              <Type className="mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">Text eingeben oder Logo hochladen</p>
              <p className="mt-1 text-xs opacity-70">
                Mehrere Elemente möglich · Verschieben, skalieren, drehen
              </p>
            </div>
          )}
        </div>
        </div>

        {(eyedropperColor || eyedropperActive || eraserActive || lassoActive || cropActive) && (
          <div className="mt-3 flex flex-wrap gap-4">
            {(eyedropperColor || eyedropperActive) && (
              <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
                <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Toleranz: {eyedropperTolerance}
                  {eyedropperColor ? (
                    <span
                      className="inline-block h-3 w-3 rounded-sm border border-border"
                      style={{
                        backgroundColor: `rgb(${eyedropperColor.r},${eyedropperColor.g},${eyedropperColor.b})`,
                      }}
                    />
                  ) : null}
                </Label>
                <input
                  type="range"
                  min={5}
                  max={120}
                  step={1}
                  value={eyedropperTolerance}
                  onChange={(e) =>
                    setEyedropperTolerance(Number(e.target.value))
                  }
                  className="w-full accent-cyan-500"
                  aria-label="Farb-Toleranz"
                />
              </div>
            )}
            {eraserActive ? (
              <div className="flex min-w-[8rem] flex-1 flex-col gap-1">
                <Label className="text-xs text-muted-foreground">
                  Pinselgrösse
                </Label>
                <input
                  type="range"
                  min={0.015}
                  max={0.12}
                  step={0.005}
                  value={eraserRadius}
                  onChange={(e) => setEraserRadius(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                  aria-label="Pinselgrösse"
                />
              </div>
            ) : null}
            {lassoActive ? (
              <p className="text-xs text-muted-foreground">
                Lasso: Bereich freihand einkreisen — Loslassen stellt frei.
              </p>
            ) : null}
            {cropActive ? (
              <p className="text-xs text-muted-foreground">
                Zuschneiden: Rechteck auf dem Bild aufziehen.
              </p>
            ) : null}
          </div>
        )}

        {(() => {
          const textEditId = editingTextLayerId ?? (
            activeLayer?.kind === "text" ? activeLayer.id : null
          )
          const textLayer = textEditId
            ? layers.find((l) => l.id === textEditId && l.kind === "text")
            : null
          if (!textLayer) return null
          const fontId = textLayer.fontId ?? selectedFont
          const inputFontStyle = {
            ...getLaserFontInputStyle(fontId),
            fontFamily: getLaserFontFamily(fontId),
          }
          return (
            <div className="relative z-0 mt-4 space-y-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-cyan-400">
                  Text bearbeiten
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setEditingTextLayerId(null)}
                >
                  Schliessen
                </Button>
              </div>
              <Textarea
                value={textLayer.text ?? ""}
                onChange={(e) => {
                  const next = updateLayerById(stateRef.current.layers, textLayer.id, {
                    text: e.target.value,
                  })
                  emitLayers(next, textLayer.id)
                }}
                onFocus={() => {
                  onStateChange({ activeLayerId: textLayer.id })
                  setEditingTextLayerId(textLayer.id)
                }}
                placeholder="Textinhalt…"
                rows={2}
                style={inputFontStyle}
                className="resize-none rounded-lg border-cyan-500/25 bg-background/60 text-sm"
                autoFocus={editingTextLayerId === textLayer.id}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Schriftart</Label>
                <select
                  value={fontId}
                  onChange={(e) => {
                    const nextFont = e.target.value as LaserFontId
                    const next = updateLayerById(stateRef.current.layers, textLayer.id, {
                      fontId: nextFont,
                    })
                    emitLayers(next, textLayer.id)
                    onStateChange({ selectedFont: nextFont })
                  }}
                  style={getLaserFontDropdownStyle(fontId)}
                  className="w-full appearance-none rounded-lg border border-border/70 bg-card/90 py-2 pl-3 pr-8 text-sm"
                >
                  {LASER_FONT_OPTIONS.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Grösse: {(textLayer.scale ?? 1).toFixed(2)}x
                </Label>
                <input
                  type="range"
                  min={MIN_LAYOUT_SCALE}
                  max={Math.max(activeMaxScale, MIN_LAYOUT_SCALE)}
                  step={0.05}
                  value={Math.min(textLayer.scale ?? 1, activeMaxScale)}
                  onChange={(e) => {
                    const next = clampScale(Number(e.target.value), activeMaxScale)
                    patchLayerLayout(textLayer.id, {
                      scale: next,
                      scaleX: next,
                      scaleY: next,
                    })
                  }}
                  className="h-2 w-full cursor-pointer accent-cyan-500"
                />
              </div>
            </div>
          )
        })()}

        <div className="relative z-0 mt-4 space-y-4 border-t border-border/50 pt-4">
          {liveMmLabel && hasAnyContent && (
            <p className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-center font-mono text-xs text-muted-foreground">
              Gravur-Grösse:{" "}
              <span className="font-semibold text-foreground">
                {liveMmLabel.widthMm.toFixed(1)} x{" "}
                {liveMmLabel.heightMm.toFixed(1)} mm
              </span>
              <span className="mx-1 text-border">·</span>
              {liveMmLabel.areaMm2.toFixed(0)} mm²
            </p>
          )}

          {activeLayer &&
            ((activeLayer.kind === "text" &&
              (activeLayer.text ?? "").trim()) ||
              (activeLayer.kind === "image" && activeLayer.src)) && (
              <ElementTransformControls
                label={
                  activeLayer.kind === "text"
                    ? "Text"
                    : "Bild / Logo"
                }
                layout={layerToElementLayout(activeLayer)}
                onChange={(patch) => patchLayerLayout(activeLayer.id, patch)}
                sizeMm={activeSizeMm}
                workAreaMm={workAreaMm}
                maxScale={activeMaxScale}
                onFitToBounds={() => handleFitToBounds(activeLayer.id)}
                onDelete={() => handleDeleteLayer(activeLayer.id)}
              />
            )}
        </div>

        <div className="mt-3 flex items-start gap-3 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-950 dark:text-cyan-100">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
          <p className="leading-relaxed">
            <span className="font-semibold">Tipp für saubere Gravuren:</span>{" "}
            Am besten ein Bild mit transparentem Hintergrund (.png / .svg)
            hochladen — oder Pipette, Lasso bzw. Radierer an der Live-Vorschau
            nutzen. Doppelklick auf Text öffnet die Textbearbeitung.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function LaserDesignerStudio({
  column,
  material,
  productName,
  state,
  onStateChange,
  workAreaMm,
  showMaterialCard = true,
  showVariantPicker = true,
  showTextLayers = true,
  varianten = [],
  customizationBackgroundUrl,
  onEngravingMetricsChange,
  previewSurfaceRef,
}: LaserDesignerStudioProps) {
  // Defensive: ensure layers array exists for consumers that omit it
  const safeState: LaserDesignerState = {
    ...state,
    layers: Array.isArray(state.layers) ? state.layers : [],
    activeLayerId: state.activeLayerId ?? null,
  }

  if (column === "preview") {
    return (
      <LaserDesignerPreview
        material={material}
        state={safeState}
        onStateChange={onStateChange}
        workAreaMm={workAreaMm}
        onEngravingMetricsChange={onEngravingMetricsChange}
        previewSurfaceRef={previewSurfaceRef}
        customizationBackgroundUrl={customizationBackgroundUrl}
      />
    )
  }

  return (
    <LaserDesignerSettings
      material={material}
      state={safeState}
      productName={productName}
      onStateChange={onStateChange}
      showMaterialCard={showMaterialCard}
      showVariantPicker={showVariantPicker}
      showTextLayers={showTextLayers}
      varianten={varianten}
    />
  )
}
