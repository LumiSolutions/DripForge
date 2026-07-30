"use client"

import { useCallback, useLayoutEffect, useEffect, useRef, useState } from "react"
import type { CSSProperties, RefObject } from "react"
import {
  CheckCircle2,
  ChevronDown,
  Crosshair,
  Eraser,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Plus,
  Scissors,
  Stamp,
  Trash2,
  Type,
  Upload,
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
import { removeLightImageBackground } from "@/lib/dripforge/remove-image-background"
import {
  DEFAULT_WORK_AREA_MM,
  type WorkAreaMm,
} from "@/lib/dripforge/laser-work-area"
import type { LaserMaterial } from "@/lib/dripforge/types"
import { LEITBILD_LASER_PREVIEW_ATTR } from "@/lib/dripforge/capture-leitbild"

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
  clientY: number
): DragSession {
  const center = getElementCenterPx(canvas, layout)
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
  }
}

function InteractiveCanvasElement({
  layerId,
  layout,
  isActive,
  isMoving,
  canvasRef,
  onSelect,
  onDragStart,
  onInnerRef,
  className,
  style,
  kind,
  children,
}: {
  layerId: string
  layout: ElementLayout
  isActive: boolean
  isMoving: boolean
  canvasRef: React.RefObject<HTMLDivElement | null>
  onSelect: () => void
  onDragStart: (session: DragSession) => void
  onInnerRef?: (el: HTMLElement | null) => void
  className?: string
  style?: React.CSSProperties
  kind: "text" | "image"
  children: React.ReactNode
}) {
  const beginDragAt = (
    mode: DragMode,
    pointerId: number,
    clientX: number,
    clientY: number
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
      clientY
    )
    try {
      canvas.setPointerCapture(pointerId)
    } catch {
      // Touch-Fallback ohne Pointer-Capture
    }
    onDragStart(session)
  }

  const beginPointerDrag = (e: React.PointerEvent, mode: DragMode) => {
    e.preventDefault()
    e.stopPropagation()
    beginDragAt(mode, e.pointerId, e.clientX, e.clientY)
  }

  const beginTouchDrag = (e: React.TouchEvent, mode: DragMode) => {
    // Moderne Browser: PointerEvents übernehmen Start; CSS touch-action sperrt Scroll.
    if (typeof window !== "undefined" && "PointerEvent" in window) return
    const touch = e.touches[0]
    if (!touch) return
    e.preventDefault()
    e.stopPropagation()
    beginDragAt(mode, touch.identifier, touch.clientX, touch.clientY)
  }

  return (
    <div
      className={cn("absolute z-10", CANVAS_TOUCH_LOCK_CLASS)}
      style={{ ...elementTransformStyle(layout), ...CANVAS_TOUCH_LOCK_STYLE }}
      data-canvas-element={layerId}
    >
      <div
        ref={onInnerRef}
        className={cn(
          "relative inline-block",
          CANVAS_TOUCH_LOCK_CLASS,
          kind === "text" ? "w-max max-w-none" : "max-w-full",
          isMoving ? "cursor-grabbing" : "cursor-grab",
          className
        )}
        style={{ ...CANVAS_TOUCH_LOCK_STYLE, ...style }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-handle]")) return
          beginPointerDrag(e, "move")
        }}
        onTouchStart={(e) => {
          if ((e.target as HTMLElement).closest("[data-handle]")) return
          beginTouchDrag(e, "move")
        }}
      >
        {children}

        {isActive && (
          <>
            <div
              className="pointer-events-none absolute inset-0 rounded-sm border border-dashed border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
              aria-hidden
            />

            <button
              type="button"
              data-handle="rotate"
              aria-label="Drehen"
              className={cn(
                "absolute left-1/2 z-30 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full",
                "border-2 border-cyan-400 bg-background shadow-md",
                "cursor-grab active:cursor-grabbing hover:bg-cyan-500/20",
                CANVAS_TOUCH_LOCK_CLASS
              )}
              style={{ top: "-2rem", ...CANVAS_TOUCH_LOCK_STYLE }}
              onPointerDown={(e) => beginPointerDrag(e, "rotate")}
              onTouchStart={(e) => beginTouchDrag(e, "rotate")}
            >
              <span className="block h-2 w-2 rounded-full bg-cyan-400" />
            </button>

            <button
              type="button"
              data-handle="resize"
              aria-label="Grösse ändern"
              className={cn(
                "absolute z-30 h-4 w-4 rounded-sm border-2 border-cyan-400 bg-cyan-400 shadow-md",
                "cursor-se-resize hover:scale-110",
                CANVAS_TOUCH_LOCK_CLASS
              )}
              style={{
                right: "-0.5rem",
                bottom: "-0.5rem",
                ...CANVAS_TOUCH_LOCK_STYLE,
              }}
              onPointerDown={(e) => beginPointerDrag(e, "resize")}
              onTouchStart={(e) => beginTouchDrag(e, "resize")}
            />
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
    onChange({
      scale: scaleForTargetWidthMm(
        layout.scale,
        sizeMm.widthMm,
        value,
        maxWidthMm,
        sliderMax
      ),
    })
  }

  const applyHeightMm = (value: number) => {
    if (!sizeMm || sizeMm.heightMm <= 0) return
    onChange({
      scale: scaleForTargetHeightMm(
        layout.scale,
        sizeMm.heightMm,
        value,
        maxHeightMm,
        sliderMax
      ),
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
          onChange={(e) =>
            onChange({ scale: clampScale(Number(e.target.value), sliderMax) })
          }
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
          onClick={() =>
            onChange({
              scale: clampScale(layout.scale - 0.1, sliderMax),
            })
          }
        >
          Kleiner
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
          onClick={() =>
            onChange({
              scale: clampScale(layout.scale + 0.1, sliderMax),
            })
          }
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
  varianten = [],
}: LaserDesignerBaseProps & {
  showMaterialCard?: boolean
  showVariantPicker?: boolean
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
            <div className="border-b border-border/50 bg-cyan-500/5 px-6 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-500">
                Wunsch-Material · {productName}
              </p>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-[auto_1fr]">
              <div
                className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-xl text-4xl shadow-inner",
                  material.iconBg
                )}
              >
                {material.icon}
              </div>
              <div>
                <h3 className={cn("text-xl font-bold", material.iconColor)}>
                  {material.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {material.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <FeatureTag label="Gravur erlaubt" allowed={material.canEngrave} />
                  <FeatureTag label="Schnitt erlaubt" allowed={material.canCut} />
                  {material.maxThickness && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-3 py-1 text-xs font-medium text-muted-foreground">
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
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Stamp className="h-4 w-4 text-cyan-400" />
              <h3 className="font-bold">Variante wählen</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {varianten.map((varianteStichwort) => {
                const isSelected = selectedVariant === varianteStichwort
                return (
                  <button
                    key={varianteStichwort}
                    type="button"
                    onClick={() => setVariant(varianteStichwort)}
                    className={cn(
                      "relative rounded-xl border p-3 text-center transition-all duration-200",
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/10 shadow-md shadow-cyan-500/15"
                        : "border-border/60 bg-background/40 hover:border-cyan-500/40 hover:bg-cyan-500/5"
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
    visibleTextLayers.length > 0 || visibleImageLayers.length > 0

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
      const innerEl = layerInnerRefs.current.get(target) ?? null

      if (mode === "move") {
        const start = getCanvasPoint(
          canvas,
          session.startClientX,
          session.startClientY
        )
        const now = getCanvasPoint(canvas, clientX, clientY)
        const rawX = startLayout.x + (now.percentX - start.percentX)
        const rawY = startLayout.y + (now.percentY - start.percentY)
        const clamped = clampLayoutPosition(canvas, innerEl, rawX, rawY)
        applyLayout(target, clamped)
        return
      }

      if (mode === "resize") {
        const center = getElementCenterPx(canvas, startLayout)
        const dist = Math.hypot(clientX - center.x, clientY - center.y) || 1
        const rawScale = (dist / session.startDistance) * startLayout.scale
        const scale = clampLayoutScaleToFit(
          canvas,
          innerEl,
          startLayout,
          rawScale
        )
        applyLayout(target, { scale })
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

  // Window-Listener: Drag bleibt aktiv auch ausserhalb des Canvas.
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const session = dragSessionRef.current
      if (!session || session.pointerId !== e.pointerId) return
      e.preventDefault()
      processDragMove(e.clientX, e.clientY, e.pointerId)
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
      processDragMove(touch.clientX, touch.clientY, touch.identifier)
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

  const handleRemoveBackground = async () => {
    if (!activeImageLayer?.src || removingBg) return
    setRemovingBg(true)
    try {
      const nextSrc = await removeLightImageBackground(activeImageLayer.src)
      const next = updateLayerById(stateRef.current.layers, activeImageLayer.id, {
        src: nextSrc,
      })
      emitLayers(next, activeImageLayer.id)
    } catch (err) {
      console.warn("Hintergrund entfernen fehlgeschlagen:", err)
    } finally {
      setRemovingBg(false)
    }
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
          Innen ziehen = verschieben · Griff oben = drehen · Griff unten rechts =
          Grösse. Alles bleibt innerhalb von {workAreaLabel}.
        </p>

        <div
          ref={assignPreviewSurfaceRef}
          {...{ [LEITBILD_LASER_PREVIEW_ATTR]: "true" }}
          className={cn(
            "relative z-0 aspect-square w-full overflow-hidden rounded-xl border-2 border-cyan-500/25 shadow-inner",
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
          {customizationBackgroundUrl && (
            <div
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${customizationBackgroundUrl})` }}
            />
          )}
          <div
            className={cn(
              "pointer-events-none absolute inset-0",
              canvasStyle.overlay,
              customizationBackgroundUrl && "opacity-40"
            )}
          />
          <div
            className="pointer-events-none absolute inset-[6%] rounded-sm border border-dashed border-cyan-400/50"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-20">
            {Array.from({ length: 36 }).map((_, i) => (
              <div key={i} className="border border-white/10" />
            ))}
          </div>

          {visibleImageLayers.map((layer) => (
            <InteractiveCanvasElement
              key={layer.id}
              layerId={layer.id}
              kind="image"
              layout={layerToElementLayout(layer)}
              isActive={activeLayerId === layer.id}
              isMoving={dragMode === "move" && activeLayerId === layer.id}
              canvasRef={canvasRef}
              onSelect={() => onStateChange({ activeLayerId: layer.id })}
              onDragStart={startDragSession}
              onInnerRef={(el) => setLayerInnerRef(layer.id, el)}
              className="z-10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={layer.src!}
                alt="Logo-Vorschau"
                className={cn(
                  "max-h-32 w-auto rounded opacity-90 drop-shadow-lg grayscale",
                  CANVAS_TOUCH_LOCK_CLASS
                )}
                style={CANVAS_TOUCH_LOCK_STYLE}
                draggable={false}
              />
            </InteractiveCanvasElement>
          ))}

          {visibleTextLayers.map((layer) => {
            const fontId = layer.fontId ?? selectedFont
            const canvasFontStyle = getLaserFontStyle(fontId, "canvas")
            const fontFamily = getLaserFontFamily(fontId)
            return (
              <InteractiveCanvasElement
                key={`${layer.id}-${fontId}`}
                layerId={layer.id}
                kind="text"
                layout={layerToElementLayout(layer)}
                isActive={activeLayerId === layer.id}
                isMoving={dragMode === "move" && activeLayerId === layer.id}
                canvasRef={canvasRef}
                onSelect={() => onStateChange({ activeLayerId: layer.id })}
                onDragStart={startDragSession}
                onInnerRef={(el) => setLayerInnerRef(layer.id, el)}
                className="z-20 w-max max-w-none px-2 text-center text-white/90 drop-shadow-lg"
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
              >
                {layer.text}
              </InteractiveCanvasElement>
            )
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

        <div className="relative z-0 mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="inline-flex w-full cursor-pointer sm:w-auto">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleImageUpload}
            />
            <span className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20 sm:w-auto">
              <Upload className="h-4 w-4" />
              Weiteres Bild hochladen
            </span>
          </label>
          {activeImageLayer ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-cyan-500/30 sm:w-auto"
                onClick={() => {
                  patchLayerLayout(activeImageLayer.id, { x: 50, y: 50 })
                  onStateChange({ activeLayerId: activeImageLayer.id })
                }}
              >
                <Crosshair className="mr-2 h-4 w-4" />
                Bild zentrieren
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => handleDeleteLayer(activeImageLayer.id)}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Bild entfernen
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-cyan-500/30 sm:w-auto"
                    disabled={removingBg}
                    onClick={() => void handleRemoveBackground()}
                  >
                    <Eraser className="mr-2 h-4 w-4" />
                    {removingBg ? "Entferne…" : "Hintergrund entfernen"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  Entfernt automatisch weisse Hintergründe für saubere
                  Gravur-Vorschauen.
                </TooltipContent>
              </Tooltip>
            </>
          ) : null}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Tipp: Für das beste Gravur-Ergebnis verwende am besten ein Bild mit
          transparentem Hintergrund (.png / .svg) — oder nutze «Hintergrund
          entfernen».
        </p>
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
      varianten={varianten}
    />
  )
}
