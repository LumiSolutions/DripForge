"use client"

import { useCallback, useLayoutEffect, useEffect, useRef, useState } from "react"
import type { CSSProperties, ReactNode, RefObject } from "react"
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
  Redo2,
  UserRound,
  Wand2,
  ArrowUp,
  ArrowDown,
  Ungroup,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  ABSOLUTE_MAX_LAYOUT_SCALE,
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
  ENGRAVING_FRAME_USABLE_FRACTION,
  fitLayoutScaleToBounds,
  measureElementMm,
  scaleForTargetHeightMm,
  scaleForTargetWidthMm,
  type ElementMmSize,
} from "@/lib/dripforge/laser-canvas-layout"
import {
  applyLayoutPatchToLayerOrGroup,
  createImageLayer,
  createTextLayer,
  deriveCompatFromLayers,
  ensureLaserLayers,
  getLayerGroupMembers,
  layerToElementLayout,
  nextLayerOffset,
  removeLayerById,
  ungroupLayers,
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
  smartKeepSubjectRemoveBackground,
  smartRemoveFromSeeds,
  type SmartSeed,
} from "@/lib/dripforge/smart-remove-background"
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
import { ImageCutoutPanel } from "@/components/dripforge/shared/image-cutout-panel"

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
  /** Slot direkt unter «Live-Vorschau», oberhalb Canvas/Werkzeuge */
  belowPreviewTitle?: ReactNode
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

type HistorySnapshot = {
  layers: LaserDesignLayer[]
  activeLayerId: string | null
}

function ToolIconButton({
  label,
  description,
  disabled,
  active,
  onClick,
  onShowInfo,
  children,
}: {
  label: string
  description: string
  disabled?: boolean
  active?: boolean
  onClick?: () => void
  onShowInfo?: (label: string, description: string) => void
  children: React.ReactNode
}) {
  const touchHandledRef = useRef(false)

  const activate = () => {
    if (disabled) return
    onShowInfo?.(label, description)
    onClick?.()
  }

  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "default" : "outline"}
      title={label}
      className={cn(
        "h-11 w-11 min-h-11 min-w-11 shrink-0 touch-manipulation",
        active && "bg-cyan-600 text-white hover:bg-cyan-500"
      )}
      disabled={disabled}
      aria-label={label}
      onPointerDown={(e) => {
        if (e.pointerType !== "touch" && e.pointerType !== "pen") return
        e.preventDefault()
        touchHandledRef.current = true
        activate()
      }}
      onClick={(e) => {
        e.preventDefault()
        if (touchHandledRef.current) {
          touchHandledRef.current = false
          return
        }
        activate()
      }}
    >
      {children}
    </Button>
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
  /** Move: erst nach Threshold echte Verschiebung (Klick/Deselect ohne Sprung) */
  hasMoved?: boolean
  historyPushed?: boolean
}

/** Pixel-Schwelle bevor ein Move-Drag die Position verändert. */
const MOVE_DRAG_THRESHOLD_PX = 5

/** Sperrt Browser-Scroll/-Select/-Drag während Canvas-Gesten (Mobil + Desktop / iOS). */
const CANVAS_TOUCH_LOCK_CLASS =
  "touch-none select-none overscroll-none [-webkit-user-drag:none] [-webkit-touch-callout:none]"

const CANVAS_TOUCH_LOCK_STYLE: CSSProperties = {
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  overscrollBehavior: "none",
  // Safari / Chromium: verhindert natives Bild-Ziehen (nicht in CSSProperties typisiert)
  ...({
    WebkitUserDrag: "none",
    WebkitOverflowScrolling: "auto",
  } as CSSProperties),
}

/** Freies Skalieren über die Gravurfläche hinaus (Zuschneiden am Rand). */
const FALLBACK_MAX_SCALE = ABSOLUTE_MAX_LAYOUT_SCALE

/**
 * CSS-Pixel-Koordinaten relativ zum Element (iOS-sicher, ohne DPR-Skalierung).
 * clientX/Y und getBoundingClientRect sind beide in CSS-Pixeln.
 */
function relFromClientRect(
  el: HTMLElement,
  clientX: number,
  clientY: number
): { relX: number; relY: number } | null {
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    relX: (clientX - rect.left) / rect.width,
    relY: (clientY - rect.top) / rect.height,
  }
}

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

function BrushMagnifier({
  src,
  relX,
  relY,
  clientX,
  clientY,
}: {
  src: string
  relX: number
  relY: number
  clientX: number
  clientY: number
}) {
  const size = 96
  const offsetY = 110
  return (
    <div
      className="pointer-events-none fixed z-[90] overflow-hidden rounded-full border-2 border-cyan-400 bg-black/40 shadow-xl"
      style={{
        width: size,
        height: size,
        left: clientX - size / 2,
        top: Math.max(8, clientY - offsetY),
        backgroundImage: `url(${src})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "250%",
        backgroundPosition: `${relX * 100}% ${relY * 100}%`,
      }}
      aria-hidden
    >
      <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/40" />
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300" />
    </div>
  )
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
    // Kein Fit-to-Bounds-Cap — Bild darf über den Rand hinaus skaliert werden
    maxScale = ABSOLUTE_MAX_LAYOUT_SCALE
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
  smartSelectActive,
  proportionalScale,
  onEyedropperSample,
  onEraserPaint,
  onLassoPoint,
  onLassoComplete,
  onCropDrag,
  onCropComplete,
  onSmartSelectSample,
  onDelete,
  onRotateStep,
  onScaleStep,
  onBringForward,
  onSendBackward,
  onEditText,
  brushRadiusRel,
  lassoPoints,
  magnifierSrc,
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
  smartSelectActive?: boolean
  proportionalScale?: boolean
  onEyedropperSample?: (relX: number, relY: number, layerId: string) => void
  onEraserPaint?: (relX: number, relY: number, clientX: number, clientY: number) => void
  onLassoPoint?: (relX: number, relY: number) => void
  magnifierSrc?: string | null
  onLassoComplete?: () => void
  onCropDrag?: (
    start: { relX: number; relY: number },
    end: { relX: number; relY: number }
  ) => void
  onCropComplete?: (
    start: { relX: number; relY: number },
    end: { relX: number; relY: number }
  ) => void
  onSmartSelectSample?: (relX: number, relY: number, layerId: string) => void
  onDelete?: () => void
  onRotateStep?: () => void
  onScaleStep?: (delta: number) => void
  onBringForward?: () => void
  onSendBackward?: () => void
  onEditText?: () => void
  brushRadiusRel?: number
  lassoPoints?: Array<{ relX: number; relY: number }>
  children: React.ReactNode
}) {
  const localInnerRef = useRef<HTMLElement | null>(null)
  const cropStartRef = useRef<{ relX: number; relY: number } | null>(null)
  const eraserPaintingRef = useRef(false)
  const eraserPointerIdRef = useRef<number | null>(null)
  const [cropPreview, setCropPreview] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  const [brushCursor, setBrushCursor] = useState<{
    relX: number
    relY: number
    clientX: number
    clientY: number
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

  const isResizeOrRotateHandle = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    const handle = target.closest("[data-handle]")
    if (!(handle instanceof HTMLElement)) return false
    const kind = handle.getAttribute("data-handle") ?? ""
    return kind === "rotate" || kind.startsWith("resize-")
  }

  const relFromEvent = (el: HTMLElement, clientX: number, clientY: number) =>
    relFromClientRect(el, clientX, clientY)

  const toolModeActive =
    Boolean(eyedropperActive) ||
    Boolean(eraserActive) ||
    Boolean(lassoActive) ||
    Boolean(cropActive) ||
    Boolean(smartSelectActive)

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
            : smartSelectActive && kind === "image" && isActive
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
          if (isHandleTarget(e.target)) {
            // Tool-/Scale-/Rotate-Handles starten eigenen Modus — kein Move
            return
          }
          if (eyedropperActive && kind === "image") {
            e.preventDefault()
            e.stopPropagation()
            onSelect()
            const rel = relFromEvent(e.currentTarget, e.clientX, e.clientY)
            if (rel) onEyedropperSample?.(rel.relX, rel.relY, layerId)
            return
          }
          if (smartSelectActive && kind === "image") {
            e.preventDefault()
            e.stopPropagation()
            onSelect()
            const rel = relFromEvent(e.currentTarget, e.clientX, e.clientY)
            if (rel) onSmartSelectSample?.(rel.relX, rel.relY, layerId)
            return
          }
          if (eraserActive && kind === "image") {
            e.preventDefault()
            e.stopPropagation()
            onSelect()
            const rel = relFromEvent(e.currentTarget, e.clientX, e.clientY)
            if (rel) {
              eraserPaintingRef.current = true
              eraserPointerIdRef.current = e.pointerId
              setBrushCursor({
                relX: rel.relX,
                relY: rel.relY,
                clientX: e.clientX,
                clientY: e.clientY,
              })
              onEraserPaint?.(rel.relX, rel.relY, e.clientX, e.clientY)
            }
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
          // Nur Move — nie Scale beim Body-Drag
          if (isResizeOrRotateHandle(e.target)) return
          e.stopPropagation()
          beginPointerDrag(e, "move")
        }}
        onPointerMove={(e) => {
          if (eraserActive && kind === "image") {
            e.preventDefault()
            const rel = relFromEvent(e.currentTarget, e.clientX, e.clientY)
            if (rel) {
              setBrushCursor({
                relX: rel.relX,
                relY: rel.relY,
                clientX: e.clientX,
                clientY: e.clientY,
              })
              const painting =
                eraserPaintingRef.current &&
                (eraserPointerIdRef.current === null ||
                  eraserPointerIdRef.current === e.pointerId)
              if (painting || e.buttons !== 0) {
                onEraserPaint?.(rel.relX, rel.relY, e.clientX, e.clientY)
              }
            }
            return
          }
          if (lassoActive && kind === "image" && (e.buttons !== 0 || e.pressure > 0)) {
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
        onPointerLeave={() => {
          if (eraserActive && !eraserPaintingRef.current) setBrushCursor(null)
        }}
        onPointerUp={(e) => {
          if (eraserActive && kind === "image") {
            eraserPaintingRef.current = false
            eraserPointerIdRef.current = null
            setBrushCursor(null)
            try {
              e.currentTarget.releasePointerCapture(e.pointerId)
            } catch {
              /* ignore */
            }
            return
          }
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
        onPointerCancel={() => {
          eraserPaintingRef.current = false
          eraserPointerIdRef.current = null
          setBrushCursor(null)
          cropStartRef.current = null
          setCropPreview(null)
        }}
        onTouchStart={(e) => {
          if (isHandleTarget(e.target)) return
          if (toolModeActive) return
          e.stopPropagation()
          beginTouchDrag(e, "move")
        }}
      >
        {children}

        {eraserActive &&
        kind === "image" &&
        isActive &&
        brushCursor &&
        brushRadiusRel ? (
          <div
            className="pointer-events-none absolute z-30 rounded-full border border-cyan-300/90 bg-cyan-400/15"
            style={{
              left: `${brushCursor.relX * 100}%`,
              top: `${brushCursor.relY * 100}%`,
              width: `${brushRadiusRel * 2 * 100}%`,
              height: `${brushRadiusRel * 2 * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
            aria-hidden
            {...{ [CAPTURE_HIDE_ATTR]: "true" }}
          />
        ) : null}

        {eraserActive &&
        kind === "image" &&
        isActive &&
        brushCursor &&
        magnifierSrc ? (
          <BrushMagnifier
            src={magnifierSrc}
            relX={brushCursor.relX}
            relY={brushCursor.relY}
            clientX={brushCursor.clientX}
            clientY={brushCursor.clientY}
          />
        ) : null}

        {lassoActive &&
        kind === "image" &&
        isActive &&
        lassoPoints &&
        lassoPoints.length > 1 ? (
          <svg
            className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
            {...{ [CAPTURE_HIDE_ATTR]: "true" }}
          >
            <polyline
              fill="rgba(34,211,238,0.08)"
              stroke="rgb(34,211,238)"
              strokeWidth={0.4}
              strokeDasharray="1.2 1.2"
              points={lassoPoints
                .map((p) => `${p.relX * 100},${p.relY * 100}`)
                .join(" ")}
            />
          </svg>
        ) : null}

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
              className="pointer-events-none absolute inset-0 rounded-sm border border-dashed border-cyan-400/90"
              aria-hidden
              {...{ [CAPTURE_HIDE_ATTR]: "true" }}
            />

            {/* Rotationsgriff: frei schwebend oberhalb der Mitte */}
            <div
              {...{ [CAPTURE_HIDE_ATTR]: "true" }}
              className="pointer-events-none absolute left-1/2 top-0 z-40 flex -translate-x-1/2 -translate-y-full flex-col items-center"
            >
              <button
                type="button"
                data-handle="rotate"
                aria-label="Drehen"
                className={cn(
                  "pointer-events-auto mb-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full",
                  "border border-cyan-400 bg-background text-cyan-500 shadow-sm hover:bg-cyan-500/20",
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
                <RotateCw className="h-2 w-2" />
              </button>
              <span
                className="block h-3 w-px bg-cyan-400/80"
                aria-hidden
              />
            </div>

            {/* Nur Scale-Handles an Ecken/Kanten — klein, ohne Aktions-Icons */}
            <div
              {...{ [CAPTURE_HIDE_ATTR]: "true" }}
              className="pointer-events-none absolute inset-0"
            >
              {RESIZE_HANDLES.map((handle) => (
                <button
                  key={handle}
                  type="button"
                  data-handle={`resize-${handle}`}
                  data-resize-handle={handle}
                  aria-label={`Grösse ändern (${handle})`}
                  className={cn(
                    "pointer-events-auto absolute z-40 h-2 w-2 rounded-[1px] border border-cyan-400/90 bg-cyan-400/80 shadow-none hover:scale-150",
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

            {/* Aktions-Toolbar unter dem Element — nicht auf den Ecken */}
            <div
              {...{ [CAPTURE_HIDE_ATTR]: "true" }}
              className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 flex -translate-x-1/2 items-center gap-1"
            >
              <button
                type="button"
                data-handle="tool-delete"
                aria-label="Löschen"
                className={cn(
                  "pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md",
                  "border border-red-400/50 bg-background text-red-500 shadow-sm hover:bg-red-500/10",
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
                <Trash2 className="h-3 w-3" />
              </button>
              <button
                type="button"
                data-handle="tool-layers-back"
                aria-label="Nach hinten senden"
                className={cn(
                  "pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md",
                  "border border-cyan-400/50 bg-background text-cyan-500 shadow-sm hover:bg-cyan-500/10",
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
                <ArrowDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                data-handle="tool-layers"
                aria-label="Nach vorne bringen"
                className={cn(
                  "pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md",
                  "border border-cyan-400/50 bg-background text-cyan-500 shadow-sm hover:bg-cyan-500/10",
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
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                data-handle="tool-scale-down"
                aria-label="Verkleinern"
                className={cn(
                  "pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md border border-cyan-500/40 bg-background text-[10px] font-bold text-cyan-500 shadow-sm",
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
                  "pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md border border-cyan-500/40 bg-background text-[10px] font-bold text-cyan-500 shadow-sm",
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
            </div>          </>
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
        <Card className="rounded-2xl border-2 border-border/60 bg-card/70 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Stamp className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold sm:text-base">Variante wählen</h3>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {varianten.map((varianteStichwort) => {
                const isSelected = selectedVariant === varianteStichwort
                return (
                  <button
                    key={varianteStichwort}
                    type="button"
                    onClick={() => setVariant(varianteStichwort)}
                    className={cn(
                      "relative min-h-11 rounded-xl border px-3 py-2.5 text-center transition-all duration-200",
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/15 shadow-md shadow-cyan-500/20"
                        : "border-border/60 bg-background/50 hover:border-cyan-500/40 hover:bg-cyan-500/5"
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isSelected ? "text-cyan-400" : "text-foreground"
                      )}
                    >
                      {varianteStichwort}
                    </span>
                    {isSelected && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500">
                        <CheckCircle2 className="h-3 w-3 text-background" />
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
  belowPreviewTitle,
}: Omit<LaserDesignerBaseProps, "productName"> & {
  workAreaMm?: WorkAreaMm
  onEngravingMetricsChange?: (metrics: LaserEngravingMetrics) => void
  previewSurfaceRef?: RefObject<HTMLDivElement | null>
  customizationBackgroundUrl?: string
  belowPreviewTitle?: ReactNode
}) {
  const { selectedFont, layers, activeLayerId } = state
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasMounted, setCanvasMounted] = useState(false)
  const layerInnerRefs = useRef<Map<string, HTMLElement>>(new Map())
  const dragSessionRef = useRef<DragSession | null>(null)
  const pushHistorySnapshotRef = useRef<() => void>(() => {})
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
  const [lassoPreviewPoints, setLassoPreviewPoints] = useState<
    Array<{ relX: number; relY: number }>
  >([])
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([])
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([])
  const [smartRemoveOpen, setSmartRemoveOpen] = useState(false)
  const [smartRemoveTolerance, setSmartRemoveTolerance] = useState(45)
  const [smartRemoveBusy, setSmartRemoveBusy] = useState(false)
  const [smartRemoveBaseSrc, setSmartRemoveBaseSrc] = useState<string | null>(
    null
  )
  const [smartRemovePreview, setSmartRemovePreview] = useState<string | null>(
    null
  )
  const [smartRemoveResult, setSmartRemoveResult] = useState<string | null>(null)
  const [smartRemoveLayerId, setSmartRemoveLayerId] = useState<string | null>(
    null
  )
  /** Additive Multi-Click Seeds (rel 0–1) */
  const [smartRemoveSeeds, setSmartRemoveSeeds] = useState<SmartSeed[]>([])
  /** auto = Subjekt/Vordergrund beibehalten; manual = Klick-Auswahl */
  const [smartRemoveAutoMode, setSmartRemoveAutoMode] = useState(false)
  const smartRemoveGenRef = useRef(0)
  const eraserBusyRef = useRef(false)
  const eraserSrcRef = useRef<string | null>(null)
  const lastBrushPointRef = useRef<{ relX: number; relY: number } | null>(null)
  const eraserStrokeStartedRef = useRef(false)
  const pendingEraserPointRef = useRef<{ relX: number; relY: number } | null>(
    null
  )
  const lassoPointsRef = useRef<Array<{ relX: number; relY: number }>>([])
  const lassoBusyRef = useRef(false)
  const historyLockedRef = useRef(false)
  const [cutoutOpen, setCutoutOpen] = useState(false)
  const [cutoutLive, setCutoutLive] = useState<{
    processedSrc: string
    maskOverlaySrc: string | null
  } | null>(null)
  const [mobileToolHint, setMobileToolHint] = useState<string | null>(null)
  const [toolToast, setToolToast] = useState<{
    label: string
    description: string
  } | null>(null)
  const toolToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pinchSessionRef = useRef<{
    targetId: string
    startDistance: number
    startScale: number
    startScaleX: number
    startScaleY: number
  } | null>(null)
  const canvasStyle = getMaterialCanvasStyle(material.id)
  const workAreaLabel = `${workAreaMm.widthMm} x ${workAreaMm.heightMm} mm`

  const showToolInfo = useCallback((label: string, description: string) => {
    if (toolToastTimerRef.current) {
      clearTimeout(toolToastTimerRef.current)
      toolToastTimerRef.current = null
    }
    setToolToast({ label, description })
    toolToastTimerRef.current = setTimeout(() => {
      setToolToast(null)
      toolToastTimerRef.current = null
    }, 2500)
  }, [])

  useEffect(() => {
    return () => {
      if (toolToastTimerRef.current) clearTimeout(toolToastTimerRef.current)
    }
  }, [])

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

  const activeGroupId = activeLayer?.groupId ?? null
  const activeGroupSize = activeGroupId
    ? getLayerGroupMembers(layers, activeLayer!.id).length
    : 0

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
    const current = stateRef.current
    const layer = current.layers.find((l) => l.id === layerId)
    if (!layer) return

    const layout = layerToElementLayout(layer)
    const next: ElementLayout = { ...layout, ...patch }

    if (patch.scale !== undefined) {
      next.scale = clampScale(patch.scale, ABSOLUTE_MAX_LAYOUT_SCALE)
      if (patch.scaleX === undefined && patch.scaleY === undefined) {
        next.scaleX = next.scale
        next.scaleY = next.scale
      }
    }
    if (patch.scaleX !== undefined || patch.scaleY !== undefined) {
      const { sx, sy } = resolvedScaleXY(next)
      next.scaleX = clampScale(sx, ABSOLUTE_MAX_LAYOUT_SCALE)
      next.scaleY = clampScale(sy, ABSOLUTE_MAX_LAYOUT_SCALE)
      next.scale = (next.scaleX + next.scaleY) / 2
    }
    // Position/Scale bewusst ungeklemmt — Motiv darf über den Rand hinausragen

    const nextLayers = applyLayoutPatchToLayerOrGroup(
      current.layers,
      layerId,
      next
    )
    emitLayers(nextLayers, layerId)
  }

  const applyLayout = useCallback(
    (layerId: string, patch: Partial<ElementLayout>) => {
      const current = stateRef.current
      const layer = current.layers.find((l) => l.id === layerId)
      if (!layer) return
      const nextLayers = applyLayoutPatchToLayerOrGroup(current.layers, layerId, {
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
      maxById[layer.id] = ABSOLUTE_MAX_LAYOUT_SCALE
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

      if (mode === "move") {
        const distPx = Math.hypot(
          clientX - session.startClientX,
          clientY - session.startClientY
        )
        // Klick ohne Ziehen / Deselect: Position unverändert lassen
        if (!session.hasMoved && distPx < MOVE_DRAG_THRESHOLD_PX) {
          return
        }
        if (!session.hasMoved) {
          session.hasMoved = true
          if (!session.historyPushed) {
            session.historyPushed = true
            pushHistorySnapshotRef.current()
          }
        }
        const start = getCanvasPoint(
          canvas,
          session.startClientX,
          session.startClientY
        )
        const now = getCanvasPoint(canvas, clientX, clientY)
        const rawX = startLayout.x + (now.percentX - start.percentX)
        const rawY = startLayout.y + (now.percentY - start.percentY)
        // Freies Verschieben über den Rand hinaus (Zuschneiden durch Overflow)
        applyLayout(target, {
          x: Math.max(-80, Math.min(180, rawX)),
          y: Math.max(-80, Math.min(180, rawY)),
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
      // Letzten pending Move flushen, bevor die Session endet (kein Snap-Back).
      if (rafId != null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      const pending = pendingRef.current
      pendingRef.current = null
      if (pending) {
        processDragMove(pending.clientX, pending.clientY, pending.pointerId)
      }
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

  // 2-Finger-Pinch: Skaliert das aktive Element (Bild/Text)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const touchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0
      const a = touches[0]
      const b = touches[1]
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      const current = stateRef.current
      const targetId = current.activeLayerId
      if (!targetId) return
      const layer = current.layers.find((l) => l.id === targetId)
      if (!layer) return

      const isVisible =
        (layer.kind === "text" && (layer.text ?? "").trim().length > 0) ||
        (layer.kind === "image" && Boolean(layer.src))
      if (!isVisible) return

      e.preventDefault()
      dragSessionRef.current = null
      setDragMode(null)

      const layout = layerToElementLayout(layer)
      pinchSessionRef.current = {
        targetId,
        startDistance: touchDistance(e.touches),
        startScale: layout.scale,
        startScaleX: layout.scaleX ?? layout.scale,
        startScaleY: layout.scaleY ?? layout.scale,
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      const session = pinchSessionRef.current
      if (!session || e.touches.length !== 2) return
      e.preventDefault()
      const dist = touchDistance(e.touches)
      const ratio = dist / session.startDistance
      const rawScale = session.startScale * ratio
      const rawScaleX = session.startScaleX * ratio
      const rawScaleY = session.startScaleY * ratio
      const layer = stateRef.current.layers.find((l) => l.id === session.targetId)
      if (!layer) return
      const maxScale = ABSOLUTE_MAX_LAYOUT_SCALE
      const scale = Math.max(MIN_LAYOUT_SCALE, Math.min(maxScale, rawScale))
      const scaleX = Math.max(MIN_LAYOUT_SCALE, Math.min(maxScale, rawScaleX))
      const scaleY = Math.max(MIN_LAYOUT_SCALE, Math.min(maxScale, rawScaleY))
      applyLayout(session.targetId, { scale, scaleX, scaleY })
    }

    const endPinch = () => {
      pinchSessionRef.current = null
    }

    canvas.addEventListener("touchstart", onTouchStart, { passive: false })
    canvas.addEventListener("touchmove", onTouchMove, { passive: false })
    canvas.addEventListener("touchend", endPinch)
    canvas.addEventListener("touchcancel", endPinch)

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart)
      canvas.removeEventListener("touchmove", onTouchMove)
      canvas.removeEventListener("touchend", endPinch)
      canvas.removeEventListener("touchcancel", endPinch)
    }
  }, [applyLayout, activeLayerId, canvasMounted])

  const assignPreviewSurfaceRef = useCallback(
    (node: HTMLDivElement | null) => {
      canvasRef.current = node
      setCanvasMounted(Boolean(node))
      if (previewSurfaceRef) {
        previewSurfaceRef.current = node
      }
    },
    [previewSurfaceRef]
  )

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/")
    )
    e.target.value = ""
    if (files.length === 0) return

    const readFileAsDataUrl = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const raw = reader.result
          if (typeof raw === "string") resolve(raw)
          else reject(new Error("Datei konnte nicht gelesen werden"))
        }
        reader.onerror = () => reject(new Error("Datei lesen fehlgeschlagen"))
        reader.readAsDataURL(file)
      })

    void (async () => {
      pushHistorySnapshot()
      deactivateImageTools()
      setCutoutOpen(false)
      setCutoutLive(null)
      setMobileToolHint(null)

      let layers = [...stateRef.current.layers]
      let lastId: string | null = null

      for (let i = 0; i < files.length; i++) {
        try {
          const src = await readFileAsDataUrl(files[i]!)
          const offset = nextLayerOffset(layers.length)
          const layer = createImageLayer({
            id:
              typeof crypto !== "undefined" &&
              typeof crypto.randomUUID === "function"
                ? `img-${crypto.randomUUID()}`
                : undefined,
            src,
            x: offset.x,
            y: offset.y,
            scale: DEFAULT_IMAGE_LAYOUT.scale,
            scaleX: DEFAULT_IMAGE_LAYOUT.scale,
            scaleY: DEFAULT_IMAGE_LAYOUT.scale,
            rotation: DEFAULT_IMAGE_LAYOUT.rotation,
          })
          layers = [...layers, layer]
          lastId = layer.id
        } catch (error) {
          console.warn("Bild-Upload fehlgeschlagen:", error)
        }
      }

      if (lastId) emitLayers(layers, lastId)
    })()
  }

  const pushHistorySnapshot = useCallback(() => {
    if (historyLockedRef.current) return
    const current = stateRef.current
    setUndoStack((prev) => [
      ...prev.slice(-29),
      {
        layers: current.layers.map((l) => ({ ...l })),
        activeLayerId: current.activeLayerId,
      },
    ])
    setRedoStack([])
  }, [])
  pushHistorySnapshotRef.current = pushHistorySnapshot

  const pushImageUndo = useCallback(
    (_layerId: string, _src: string) => {
      pushHistorySnapshot()
    },
    [pushHistorySnapshot]
  )

  const clearPipetteLiveChain = useCallback(() => {
    setEyedropperColor(null)
    setEyedropperBaseSrc(null)
    setEyedropperLayerId(null)
  }, [])

  const deactivateImageTools = useCallback(
    (except?: "eyedropper" | "eraser" | "lasso" | "crop" | "smart") => {
      if (except !== "eyedropper") setEyedropperActive(false)
      if (except !== "eraser") setEraserActive(false)
      if (except !== "lasso") setLassoActive(false)
      if (except !== "crop") setCropActive(false)
      if (except !== "smart") {
        setSmartRemoveOpen(false)
        setSmartRemovePreview(null)
        setSmartRemoveResult(null)
        setSmartRemoveBaseSrc(null)
        setSmartRemoveLayerId(null)
        setSmartRemoveSeeds([])
        setSmartRemoveAutoMode(false)
        smartRemoveGenRef.current += 1
      }
    },
    []
  )

  const applyHistorySnapshot = useCallback(
    (snap: HistorySnapshot) => {
      clearPipetteLiveChain()
      historyLockedRef.current = true
      emitLayers(
        snap.layers.map((l) => ({ ...l })),
        snap.activeLayerId
      )
      queueMicrotask(() => {
        historyLockedRef.current = false
      })
    },
    [clearPipetteLiveChain, emitLayers]
  )

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      const next = prev.slice(0, -1)
      const current = stateRef.current
      setRedoStack((redo) => [
        ...redo.slice(-29),
        {
          layers: current.layers.map((l) => ({ ...l })),
          activeLayerId: current.activeLayerId,
        },
      ])
      applyHistorySnapshot(last)
      return next
    })
  }, [applyHistorySnapshot])

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      const next = prev.slice(0, -1)
      const current = stateRef.current
      setUndoStack((undo) => [
        ...undo.slice(-29),
        {
          layers: current.layers.map((l) => ({ ...l })),
          activeLayerId: current.activeLayerId,
        },
      ])
      applyHistorySnapshot(last)
      return next
    })
  }, [applyHistorySnapshot])

  const startDragSession = useCallback(
    (session: DragSession) => {
      // Move: History erst nach Drag-Threshold — reiner Klick/Deselect verschiebt nichts.
      if (session.mode !== "move") {
        pushHistorySnapshot()
        session.historyPushed = true
      } else {
        session.hasMoved = false
        session.historyPushed = false
      }
      dragSessionRef.current = session
      onStateChange({ activeLayerId: session.target })
      setDragMode(session.mode)
    },
    [onStateChange, pushHistorySnapshot]
  )

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

  const resetSmartRemoveState = useCallback(() => {
    setSmartRemoveOpen(false)
    setSmartRemovePreview(null)
    setSmartRemoveResult(null)
    setSmartRemoveBaseSrc(null)
    setSmartRemoveLayerId(null)
    setSmartRemoveSeeds([])
    setSmartRemoveAutoMode(false)
    smartRemoveGenRef.current += 1
  }, [])

  const runSmartRemovePreview = useCallback(
    async (
      src: string,
      tolerance: number,
      seeds: SmartSeed[],
      autoMode: boolean
    ) => {
      const gen = ++smartRemoveGenRef.current
      setSmartRemoveBusy(true)
      try {
        let out
        if (autoMode) {
          out = await smartKeepSubjectRemoveBackground(src, tolerance)
        } else if (seeds.length > 0) {
          out = await smartRemoveFromSeeds(src, seeds, tolerance)
        } else {
          if (gen === smartRemoveGenRef.current) {
            setSmartRemovePreview(null)
            setSmartRemoveResult(null)
          }
          return
        }
        if (gen !== smartRemoveGenRef.current) return
        setSmartRemovePreview(out.previewHighlight)
        setSmartRemoveResult(out.result)
      } catch (err) {
        console.warn("Smart-Remove Vorschau fehlgeschlagen:", err)
      } finally {
        if (gen === smartRemoveGenRef.current) setSmartRemoveBusy(false)
      }
    },
    []
  )

  const openSmartRemove = () => {
    if (!activeImageLayer?.src) return
    deactivateImageTools("smart")
    setSmartRemoveLayerId(activeImageLayer.id)
    setSmartRemoveBaseSrc(activeImageLayer.src)
    setSmartRemoveSeeds([])
    setSmartRemoveAutoMode(false)
    setSmartRemovePreview(null)
    setSmartRemoveResult(null)
    setSmartRemoveOpen(true)
    setSmartRemoveTolerance(45)
  }

  const handleSmartSelectSample = useCallback(
    (relX: number, relY: number, layerId: string) => {
      if (!smartRemoveOpen || !smartRemoveBaseSrc) return
      if (smartRemoveLayerId && layerId !== smartRemoveLayerId) return
      setSmartRemoveAutoMode(false)
      setSmartRemoveSeeds((prev) => [...prev, { relX, relY }])
    },
    [smartRemoveOpen, smartRemoveBaseSrc, smartRemoveLayerId]
  )

  const handleSmartKeepSubject = () => {
    if (!smartRemoveBaseSrc) return
    setSmartRemoveAutoMode(true)
    setSmartRemoveSeeds([])
  }

  const clearSmartSeeds = () => {
    setSmartRemoveAutoMode(false)
    setSmartRemoveSeeds([])
    setSmartRemovePreview(null)
    setSmartRemoveResult(null)
    smartRemoveGenRef.current += 1
    setSmartRemoveBusy(false)
  }

  const applySmartRemove = () => {
    if (!smartRemoveResult || !smartRemoveLayerId || !smartRemoveBaseSrc) return
    pushHistorySnapshot()
    const next = updateLayerById(stateRef.current.layers, smartRemoveLayerId, {
      src: smartRemoveResult,
    })
    emitLayers(next, smartRemoveLayerId)
    clearPipetteLiveChain()
    resetSmartRemoveState()
  }

  const cancelSmartRemove = () => {
    resetSmartRemoveState()
  }

  useEffect(() => {
    if (!smartRemoveOpen || !smartRemoveBaseSrc) return
    if (!smartRemoveAutoMode && smartRemoveSeeds.length === 0) return
    const t = window.setTimeout(() => {
      void runSmartRemovePreview(
        smartRemoveBaseSrc,
        smartRemoveTolerance,
        smartRemoveSeeds,
        smartRemoveAutoMode
      )
    }, 80)
    return () => window.clearTimeout(t)
  }, [
    smartRemoveOpen,
    smartRemoveBaseSrc,
    smartRemoveTolerance,
    smartRemoveSeeds,
    smartRemoveAutoMode,
    runSmartRemovePreview,
  ])

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
    if (!layerId) return
    const current = eraserSrcRef.current ?? activeImageLayer?.src
    if (!current || !eraserActive) return
    if (eraserBusyRef.current) {
      pendingEraserPointRef.current = { relX, relY }
      return
    }
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
      const pending = pendingEraserPointRef.current
      if (pending) {
        pendingEraserPointRef.current = null
        void handleEraserPaint(pending.relX, pending.relY)
      }
    }
  }

  const handleEraserPaintSafe = (
    relX: number,
    relY: number,
    _clientX?: number,
    _clientY?: number
  ) => {
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
    setLassoPreviewPoints([...lassoPointsRef.current])
  }

  const handleLassoComplete = async () => {
    if (!activeImageLayer?.src || lassoBusyRef.current) return
    const points = lassoPointsRef.current
    lassoPointsRef.current = []
    setLassoPreviewPoints([])
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
    <Card className="relative isolate w-full max-w-full overflow-hidden rounded-xl border-cyan-500/20 bg-card/50 shadow-lg shadow-cyan-500/5">
      <CardContent className="relative box-border flex w-full max-w-full flex-col gap-0 overflow-hidden p-2 sm:p-4 md:p-5">
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

        {belowPreviewTitle ? (
          <div className="mb-3 w-full">{belowPreviewTitle}</div>
        ) : null}

        <p className="mb-3 text-xs text-muted-foreground">
          Innen ziehen = verschieben · Griff oben rechts = drehen · 8 Griffe =
          skalieren · zwei Finger = Pinch-Zoom. Alles bleibt innerhalb von{" "}
          {workAreaLabel}.
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleImageUpload}
            />
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20">
              <Plus className="h-3.5 w-3.5" />
              Bild(er)
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

        <div className="relative box-border flex w-full min-w-0 max-w-full flex-col gap-2 overflow-hidden md:flex-row md:items-start">
          {/* Mobile: horizontal · Desktop: 2-Spalten-Grid statt langer Spalte */}
          <div
            className="order-1 grid w-full max-w-full shrink-0 grid-cols-4 gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid-cols-5 md:order-none md:w-[5.75rem] md:grid-cols-2 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden"
            {...{ [CAPTURE_HIDE_ATTR]: "true" }}
          >
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Pipette"
              description="Klicke auf eine Farbe im Bild, um ähnliche Pixel transparent zu machen. Toleranz danach per Slider feinjustieren."
              active={eyedropperActive}
              disabled={removingBg || !activeImageLayer}
              onClick={() => {
                deactivateImageTools("eyedropper")
                setEyedropperActive((v) => {
                  const next = !v
                  setMobileToolHint(
                    next
                      ? "Pipette aktiv — Tippe eine Farbe an, die entfernt werden soll"
                      : null
                  )
                  return next
                })
              }}
            >
              <Pipette className="h-4 w-4" />
            </ToolIconButton>
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Pinsel / Radierer"
              description="Zeichne freihand, um Bereiche transparent zu machen. Pinselgrösse unten einstellen."
              active={eraserActive}
              disabled={!activeImageLayer}
              onClick={() => {
                deactivateImageTools("eraser")
                setEraserActive((v) => {
                  const next = !v
                  setMobileToolHint(
                    next
                      ? "Radiergummi aktiv — Wische über Bereiche zum Löschen"
                      : null
                  )
                  return next
                })
              }}
            >
              <Eraser className="h-4 w-4" />
            </ToolIconButton>
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Lasso freistellen"
              description="Kreise einen Bereich freihand ein; nach dem Loslassen wird nur dieser Teil entfernt."
              active={lassoActive}
              disabled={!activeImageLayer}
              onClick={() => {
                deactivateImageTools("lasso")
                lassoPointsRef.current = []
                setLassoPreviewPoints([])
                setLassoActive((v) => {
                  const next = !v
                  setMobileToolHint(
                    next
                      ? "Lasso aktiv — Umschliesse den Bereich, der entfernt werden soll"
                      : null
                  )
                  return next
                })
              }}
            >
              <Lasso className="h-4 w-4" />
            </ToolIconButton>
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Bild zuschneiden"
              description="Ziehe ein Rechteck auf dem Bild auf, um es zuzuschneiden."
              active={cropActive}
              disabled={!activeImageLayer}
              onClick={() => {
                deactivateImageTools("crop")
                setCropActive((v) => !v)
              }}
            >
              <Crop className="h-4 w-4" />
            </ToolIconButton>
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Weiss entfernen"
              description="Entfernt sehr helle/weisse Hintergründe automatisch — ideal für Logos auf Weiss."
              disabled={removingBg || !activeImageLayer}
              onClick={() => void handleRemoveBackground()}
            >
              <Scissors className="h-4 w-4" />
            </ToolIconButton>
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Intelligent freistellen"
              description="Mehrfach-Klick auf Hintergrundbereiche (additiv). Kanten-Stop schützt Motive. Optional: Subjekt / Vordergrund beibehalten."
              active={smartRemoveOpen}
              disabled={removingBg || !activeImageLayer || smartRemoveBusy}
              onClick={() => {
                if (smartRemoveOpen) {
                  cancelSmartRemove()
                  return
                }
                openSmartRemove()
              }}
            >
              <Wand2 className="h-4 w-4" />
            </ToolIconButton>
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Freistell-Studio"
              description="Erweitertes Freistellen mit Wiederherstellen-Pinsel, Subjekt-/Vordergrund-Erkennung, Live-Maske und Lupe."
              active={cutoutOpen}
              disabled={!activeImageLayer}
              onClick={() => {
                if (!activeImageLayer) return
                deactivateImageTools()
                setCutoutOpen((v) => {
                  const next = !v
                  setMobileToolHint(
                    next
                      ? "Wiederherstellen-Pinsel aktiv — Wische über gelöschte Stellen zum Wiederherstellen"
                      : null
                  )
                  if (!next) setCutoutLive(null)
                  return next
                })
              }}
            >
              <Stamp className="h-4 w-4" />
            </ToolIconButton>
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Zentrieren"
              description="Platziert das gewählte Element exakt in der Mitte der Gravurfläche."
              disabled={!activeLayer}
              onClick={() => {
                if (!activeLayer) return
                pushHistorySnapshot()
                patchLayerLayout(activeLayer.id, { x: 50, y: 50 })
                onStateChange({ activeLayerId: activeLayer.id })
              }}
            >
              <Crosshair className="h-4 w-4" />
            </ToolIconButton>
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Rückgängig"
              description="Macht die letzte Änderung rückgängig (Position, Grösse, Rotation, Freistellen, Text)."
              disabled={undoStack.length === 0}
              onClick={handleUndo}
            >
              <Undo2 className="h-4 w-4" />
            </ToolIconButton>
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Wiederholen"
              description="Stellt die zuletzt rückgängig gemachte Änderung wieder her."
              disabled={redoStack.length === 0}
              onClick={handleRedo}
            >
              <Redo2 className="h-4 w-4" />
            </ToolIconButton>
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Nach vorne"
              description="Verschiebt die aktive Ebene eine Stufe nach vorne (über andere Elemente)."
              disabled={!activeLayerId}
              onClick={() => {
                if (!activeLayerId) return
                pushHistorySnapshot()
                bringLayerForward(activeLayerId)
              }}
            >
              <ArrowUp className="h-4 w-4" />
            </ToolIconButton>
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Nach hinten"
              description="Verschiebt die aktive Ebene eine Stufe nach hinten (unter andere Elemente)."
              disabled={!activeLayerId}
              onClick={() => {
                if (!activeLayerId) return
                pushHistorySnapshot()
                sendLayerBackward(activeLayerId)
              }}
            >
              <ArrowDown className="h-4 w-4" />
            </ToolIconButton>
            <ToolIconButton
              onShowInfo={showToolInfo}
              label="Gruppe auflösen"
              description="Löst die geladene Design-Gruppe auf, damit einzelne Texte und Bilder wieder separat bewegt werden können."
              disabled={activeGroupSize < 2}
              onClick={() => {
                if (!activeGroupId) return
                pushHistorySnapshot()
                emitLayers(
                  ungroupLayers(stateRef.current.layers, activeGroupId),
                  activeLayerId
                )
                setMobileToolHint("Gruppe aufgelöst — Elemente einzeln bearbeitbar")
              }}
            >
              <Ungroup className="h-4 w-4" />
            </ToolIconButton>
          </div>

        <div
          ref={assignPreviewSurfaceRef}
          {...{ [LEITBILD_LASER_PREVIEW_ATTR]: "true" }}
          className={cn(
            "relative z-0 order-2 mx-auto aspect-square min-h-[min(100%,22rem)] min-w-0 w-full max-w-full flex-1 overflow-hidden rounded-xl border-2 border-cyan-500/25 shadow-inner [contain:layout_paint] sm:min-h-[26rem] lg:min-h-[30rem] xl:min-h-[34rem]",
            CANVAS_TOUCH_LOCK_CLASS,
            canvasStyle.surface
          )}
          style={{
            ...CANVAS_TOUCH_LOCK_STYLE,
            aspectRatio: "1 / 1",
            width: "100%",
            maxWidth: "100%",
            height: "auto",
            maxHeight: "min(92vw, 40rem)",
            boxSizing: "border-box",
            overscrollBehavior: "none",
            WebkitOverflowScrolling: "auto",
          } as CSSProperties}
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
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
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
            const isGroupMate =
              Boolean(activeGroupId) &&
              layer.groupId === activeGroupId &&
              !isActive
            if (layer.kind === "image" && layer.src) {
              return (
                <InteractiveCanvasElement
                  key={layer.id}
                  layerId={layer.id}
                  kind="image"
                  layout={layerToElementLayout(layer)}
                  isActive={isActive}
                  isMoving={dragMode != null && (isActive || isGroupMate)}
                  stackIndex={index}
                  canvasRef={canvasRef}
                  onSelect={() => {
                    onStateChange({ activeLayerId: layer.id })
                    setEditingTextLayerId(null)
                  }}
                  onDragStart={startDragSession}
                  onInnerRef={(el) => setLayerInnerRef(layer.id, el)}
                  eyedropperActive={eyedropperActive}
                  eraserActive={eraserActive}
                  lassoActive={lassoActive}
                  cropActive={cropActive}
                  smartSelectActive={
                    smartRemoveOpen && smartRemoveLayerId === layer.id
                  }
                  proportionalScale={proportionalScale}
                  brushRadiusRel={eraserRadius}
                  magnifierSrc={layer.src}
                  lassoPoints={
                    isActive && lassoActive ? lassoPreviewPoints : undefined
                  }
                  onEyedropperSample={(relX, relY, id) => {
                    void handleEyedropperSample(relX, relY, id)
                  }}
                  onSmartSelectSample={handleSmartSelectSample}
                  onEraserPaint={handleEraserPaintSafe}
                  onLassoPoint={handleLassoPoint}
                  onLassoComplete={() => {
                    void handleLassoComplete()
                  }}
                  onCropComplete={(start, end) => {
                    void handleCropComplete(start, end)
                  }}
                  onDelete={() => {
                    pushHistorySnapshot()
                    handleDeleteLayer(layer.id)
                  }}
                  onRotateStep={() => {
                    pushHistorySnapshot()
                    patchLayerLayout(layer.id, {
                      rotation: normalizeRotation((layer.rotation ?? 0) + 15),
                    })
                  }}
                  onScaleStep={(delta) => {
                    pushHistorySnapshot()
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
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        cutoutOpen &&
                        cutoutLive?.processedSrc &&
                        activeLayerId === layer.id
                          ? cutoutLive.processedSrc
                          : layer.src
                      }
                      alt="Logo-Vorschau"
                      className={cn(
                        "max-h-32 w-auto rounded opacity-90 drop-shadow-lg grayscale",
                        CANVAS_TOUCH_LOCK_CLASS
                      )}
                      style={CANVAS_TOUCH_LOCK_STYLE}
                      draggable={false}
                      crossOrigin="anonymous"
                    />
                    {cutoutOpen &&
                    cutoutLive?.maskOverlaySrc &&
                    activeLayerId === layer.id ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cutoutLive.maskOverlaySrc}
                        alt=""
                        aria-hidden
                        className="pointer-events-none absolute inset-0 h-full w-full max-h-32 rounded object-contain opacity-90"
                        draggable={false}
                      />
                    ) : null}
                  </div>
                </InteractiveCanvasElement>
              )
            }

            if (layer.kind === "text") {
              const text = (layer.text ?? "").trim()
              // Leerer Text nur rendern wenn aktiv — damit Auswahl/Move funktioniert
              if (!text && !isActive && !isGroupMate) return null
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
                  isMoving={dragMode != null && (isActive || isGroupMate)}
                  stackIndex={index}
                  canvasRef={canvasRef}
                  onSelect={() => {
                    onStateChange({ activeLayerId: layer.id })
                    setEditingTextLayerId(layer.id)
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
                  onDelete={() => {
                    pushHistorySnapshot()
                    handleDeleteLayer(layer.id)
                  }}
                  onRotateStep={() => {
                    pushHistorySnapshot()
                    patchLayerLayout(layer.id, {
                      rotation: normalizeRotation((layer.rotation ?? 0) + 15),
                    })
                  }}
                  onScaleStep={(delta) => {
                    pushHistorySnapshot()
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

        {(eyedropperColor || eyedropperActive || eraserActive || lassoActive || cropActive || smartRemoveOpen) && (
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

        {smartRemoveOpen && smartRemoveBaseSrc ? (
          <div className="relative z-0 mt-4 space-y-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-violet-400">
                Intelligent freistellen — Mehrfach-Auswahl
              </p>              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={cancelSmartRemove}              >
                Abbrechen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Klicke auf dem Bild in der Vorschau auf Hintergrundbereiche (z.&nbsp;B.
              Himmel, dann Wolken). Jeder Klick wird additiv hinzugefügt.
              Scharfe Kanten stoppen die Auswahl.
              {smartRemoveSeeds.length > 0
                ? ` · ${smartRemoveSeeds.length} Bereich${smartRemoveSeeds.length === 1 ? "" : "e"}`
                : null}
              {smartRemoveAutoMode ? " · Auto: Subjekt / Vordergrund" : null}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Vorher
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={smartRemoveBaseSrc}
                  alt="Original"
                  className="max-h-36 w-full rounded-md border border-border/50 object-contain bg-[linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_75%,#ccc_75%),linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_75%,#ccc_75%)] bg-[length:12px_12px] bg-[position:0_0,6px_6px]"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {smartRemoveBusy
                    ? "Berechne…"
                    : smartRemoveResult
                      ? "Maske / Nachher"
                      : "Klicke aufs Bild…"}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    smartRemovePreview ??
                    smartRemoveResult ??
                    smartRemoveBaseSrc
                  }
                  alt="Vorschau Freistellen"
                  className="max-h-36 w-full rounded-md border border-border/50 object-contain bg-[linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_75%,#ccc_75%),linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_75%,#ccc_75%)] bg-[length:12px_12px] bg-[position:0_0,6px_6px]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Toleranz: {smartRemoveTolerance} — höher = mehr Hintergrund weg
              </Label>
              <input
                type="range"
                min={10}
                max={120}
                step={1}
                value={smartRemoveTolerance}
                onChange={(e) =>
                  setSmartRemoveTolerance(Number(e.target.value))
                }
                className="w-full accent-violet-500"
                aria-label="Smart-Remove Toleranz"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 border-violet-500/40 text-violet-300 hover:bg-violet-500/10"
                disabled={smartRemoveBusy || !smartRemoveBaseSrc}
                onClick={handleSmartKeepSubject}
              >
                <UserRound className="h-3.5 w-3.5" />
                Subjekt / Vordergrund beibehalten
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-xs"
                disabled={
                  smartRemoveBusy ||
                  (smartRemoveSeeds.length === 0 && !smartRemoveAutoMode)
                }
                onClick={clearSmartSeeds}
              >
                Auswahl zurücksetzen
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-violet-600 text-white hover:bg-violet-500"
                disabled={!smartRemoveResult || smartRemoveBusy}
                onClick={applySmartRemove}
              >
                Übernehmen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={cancelSmartRemove}
              >
                Verwerfen
              </Button>
            </div>
          </div>
        ) : null}

        {(() => {
          // Nur das aktuell aktive Text-Element (activeLayerId)
          const textLayer =
            activeLayer?.kind === "text" ? activeLayer : null
          if (!textLayer) return null
          const fontId = textLayer.fontId ?? selectedFont
          const inputFontStyle = {
            ...getLaserFontInputStyle(fontId),
            fontFamily: getLaserFontFamily(fontId),
          }
          return (
            <div
              key={textLayer.id}
              className="relative z-0 mt-4 space-y-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-cyan-400">
                  Text bearbeiten
                  <span className="ml-2 font-normal text-muted-foreground">
                    (
                    {layers
                      .filter((l) => l.kind === "text")
                      .findIndex((l) => l.id === textLayer.id) + 1}
                    )
                  </span>
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setEditingTextLayerId(null)
                    onStateChange({ activeLayerId: null })
                  }}
                >
                  Schliessen
                </Button>
              </div>
              <Textarea
                key={`text-content-${textLayer.id}`}
                value={textLayer.text ?? ""}
                onChange={(e) => {
                  const next = updateLayerById(
                    stateRef.current.layers,
                    textLayer.id,
                    {
                      text: e.target.value,
                    }
                  )
                  emitLayers(next, textLayer.id)
                }}
                onFocus={() => {
                  pushHistorySnapshot()
                  onStateChange({ activeLayerId: textLayer.id })
                  setEditingTextLayerId(textLayer.id)
                }}
                placeholder="Textinhalt…"
                rows={2}
                style={inputFontStyle}
                className="resize-none rounded-lg border-cyan-500/25 bg-background/60 text-sm"
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Schriftart</Label>
                <select
                  key={`text-font-${textLayer.id}`}
                  value={fontId}
                  onChange={(e) => {
                    const nextFont = e.target.value as LaserFontId
                    pushHistorySnapshot()
                    const next = updateLayerById(
                      stateRef.current.layers,
                      textLayer.id,
                      {
                        fontId: nextFont,
                      }
                    )
                    emitLayers(next, textLayer.id)
                    onStateChange({ selectedFont: nextFont })
                  }}
                  style={getLaserFontDropdownStyle(fontId)}
                  className="w-full appearance-none rounded-lg border border-border/70 bg-card/90 py-2 pl-3 pr-8 text-sm"
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
                    const next = clampScale(
                      Number(e.target.value),
                      activeMaxScale
                    )
                    pushHistorySnapshot()
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

        {toolToast ? (
          <div
            className="pointer-events-none absolute left-1/2 top-16 z-40 w-[min(92%,20rem)] -translate-x-1/2 rounded-lg border border-cyan-500/40 bg-background/95 px-3 py-2 text-center shadow-lg backdrop-blur-sm md:left-[3.25rem] md:top-20 md:translate-x-0 md:text-left"
            role="status"
            aria-live="polite"
          >
            <p className="text-xs font-semibold text-cyan-400">{toolToast.label}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {toolToast.description}
            </p>
          </div>
        ) : null}

        {mobileToolHint ? (
          <div className="mt-2 rounded-md bg-secondary/60 px-3 py-2 text-center text-xs text-muted-foreground sm:hidden">
            {mobileToolHint}
          </div>
        ) : null}

        {cutoutOpen && activeImageLayer?.src ? (
          <ImageCutoutPanel
            sourceSrc={activeImageLayer.src}
            open={cutoutOpen}
            onClose={() => {
              setCutoutOpen(false)
              setCutoutLive(null)
              setMobileToolHint(null)
            }}
            onLivePreviewChange={setCutoutLive}
            onApply={(processedDataUrl) => {
              pushHistorySnapshot()
              const next = updateLayerById(
                stateRef.current.layers,
                activeImageLayer.id,
                { src: processedDataUrl }
              )
              emitLayers(next, activeImageLayer.id)
              setCutoutOpen(false)
              setCutoutLive(null)
              setMobileToolHint("Freistellen übernommen")
            }}
          />
        ) : null}
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
  belowPreviewTitle,
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
        belowPreviewTitle={belowPreviewTitle}
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
