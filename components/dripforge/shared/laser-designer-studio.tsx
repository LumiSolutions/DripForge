"use client"

import { useCallback, useLayoutEffect, useEffect, useRef, useState } from "react"
import type { CSSProperties, RefObject } from "react"
import {
  CheckCircle2,
  ChevronDown,
  Image as ImageIcon,
  Layers,
  Scissors,
  Stamp,
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
  MATERIAL_CANVAS_STYLES,
  normalizeRotation,
  pointerAngleDegrees,
  type ElementLayout,
  type ImageLayout,
  type LaserFontId,
} from "@/lib/dripforge/laser-design"
import {
  clampLayoutPosition,
  clampLayoutScaleToFit,
  measureElementMm,
  scaleForTargetHeightMm,
  scaleForTargetWidthMm,
  type ElementMmSize,
} from "@/lib/dripforge/laser-canvas-layout"
import {
  DEFAULT_WORK_AREA_MM,
  type WorkAreaMm,
} from "@/lib/dripforge/laser-work-area"
import type { LaserMaterial } from "@/lib/dripforge/types"
import { LEITBILD_LASER_PREVIEW_ATTR } from "@/lib/dripforge/capture-leitbild"

export type LaserDesignerState = {
  selectedVariant: string
  selectedFont: LaserFontId
  engravingText: string
  textLayout: ElementLayout
  imageLayout: ImageLayout
}

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
  /** Admin-Hintergrundbild fuer Laser-Individualisierung */
  customizationBackgroundUrl?: string
  onEngravingMetricsChange?: (metrics: LaserEngravingMetrics) => void
  /** Ref auf die Live-Vorschau-Flaeche fuer Leitbild-Snapshot beim Warenkorb */
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
  }
}

type ElementTarget = "text" | "image"

type DragMode = "move" | "resize" | "rotate"

type DragSession = {
  mode: DragMode
  target: ElementTarget
  pointerId: number
  startLayout: ElementLayout
  startClientX: number
  startClientY: number
  startPointerAngle: number
  startDistance: number
  centerClientX: number
  centerClientY: number
}

/** Sperrt Browser-Scroll/-Select/-Drag waehrend Canvas-Gesten (Mobil + Desktop). */
const CANVAS_TOUCH_LOCK_CLASS =
  "touch-none select-none [-webkit-user-drag:none] [-webkit-touch-callout:none]"

const CANVAS_TOUCH_LOCK_STYLE: CSSProperties = {
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  // Safari / Chromium: verhindert natives Bild-Ziehen (nicht in CSSProperties typisiert)
  ...({ WebkitUserDrag: "none" } as CSSProperties),
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
  target: ElementTarget,
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
  target,
  layout,
  isActive,
  isMoving,
  canvasRef,
  onSelect,
  onDragStart,
  onInnerRef,
  className,
  style,
  children,
}: {
  target: ElementTarget
  layout: ElementLayout
  isActive: boolean
  isMoving: boolean
  canvasRef: React.RefObject<HTMLDivElement | null>
  onSelect: () => void
  onDragStart: (session: DragSession) => void
  onInnerRef?: (el: HTMLElement | null) => void
  className?: string
  style?: React.CSSProperties
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
      target,
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
    // Moderne Browser: PointerEvents uebernehmen Start; CSS touch-action sperrt Scroll.
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
      data-canvas-element={target}
    >
      <div
        ref={onInnerRef}
        className={cn(
          "relative inline-block",
          CANVAS_TOUCH_LOCK_CLASS,
          target === "text" ? "w-max max-w-none" : "max-w-full",
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
              aria-label="Groesse aendern"
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
}: {
  label: string
  layout: ElementLayout
  onChange: (patch: Partial<ElementLayout>) => void
  sizeMm: ElementMmSize | null
  workAreaMm: WorkAreaMm
}) {
  const maxWidthMm = workAreaMm.widthMm * 0.88
  const maxHeightMm = workAreaMm.heightMm * 0.88

  const applyWidthMm = (value: number) => {
    if (!sizeMm || sizeMm.widthMm <= 0) return
    onChange({
      scale: scaleForTargetWidthMm(
        layout.scale,
        sizeMm.widthMm,
        value,
        maxWidthMm
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
        maxHeightMm
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
          <Label className="text-xs">Hoehe (mm)</Label>
          <Input
            type="number"
            min={1}
            max={maxHeightMm}
            step={0.1}
            value={sizeMm ? Number(sizeMm.heightMm.toFixed(1)) : ""}
            disabled={!sizeMm}
            onChange={(e) => applyHeightMm(Number(e.target.value))}
            className="h-9 tabular-nums"
            aria-label="Gravur-Hoehe in Millimetern"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <Label>Groesse (Skalierung)</Label>
          <span className="font-mono text-muted-foreground">{layout.scale.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min={0.3}
          max={3}
          step={0.05}
          value={layout.scale}
          onChange={(e) => onChange({ scale: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer accent-cyan-500"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <Label>Rotation</Label>
          <span className="font-mono text-muted-foreground">{Math.round(layout.rotation)}°</span>
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
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
          onClick={() => onChange({ scale: Math.max(0.3, layout.scale - 0.1) })}
        >
          Kleiner
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
          onClick={() => onChange({ scale: Math.min(3, layout.scale + 0.1) })}
        >
          Groesser
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
      </div>
    </div>
  )
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
  const { selectedVariant, selectedFont, engravingText } = state
  const hasVarianten = varianten.length > 0
  const hasText = engravingText.trim().length > 0
  const setVariant = (variant: string) => onStateChange({ selectedVariant: variant })
  const setFont = (font: LaserFontId) => onStateChange({ selectedFont: font })
  const setEngravingText = (text: string) => onStateChange({ engravingText: text })
  const inputFontStyle = {
    ...getLaserFontInputStyle(selectedFont),
    fontFamily: getLaserFontFamily(selectedFont),
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
            <h3 className="font-bold">Variante waehlen</h3>
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
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="designer-font" className="text-sm font-semibold">
              Schriftart waehlen
            </Label>
            {!hasText && (
              <p className="text-xs text-muted-foreground">
                Bitte zuerst Gravur-Text eingeben, um die Schriftart zu waehlen.
              </p>
            )}
            <div className="relative">
              <select
                id="designer-font"
                value={selectedFont}
                disabled={!hasText}
                onChange={(e) => setFont(e.target.value as LaserFontId)}
              style={getLaserFontDropdownStyle(selectedFont)}
                className={cn(
                  "w-full appearance-none rounded-lg border border-border/70 bg-card/90 py-2.5 pl-4 pr-10 text-sm text-foreground",
                  "shadow-[0_0_24px_-12px] shadow-cyan-500/30",
                  "transition-all duration-200",
                  "hover:border-cyan-500/35",
                  "focus:border-cyan-500/55 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:shadow-[0_0_28px_-8px] focus:shadow-cyan-500/40",
                  !hasText && "cursor-not-allowed opacity-50"
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

          <div>
            <Label htmlFor="designer-engraving" className="mb-3 block text-base font-bold">
              Ihre Wunschgravur / Text
            </Label>
            <Textarea
              id="designer-engraving"
              value={engravingText}
              onChange={(e) => setEngravingText(e.target.value)}
              placeholder="z.B. Firmenname, Datum, Widmung..."
              rows={4}
              style={inputFontStyle}
              className={cn(
                "resize-none rounded-lg border-cyan-500/25 bg-background/60 text-sm",
                "placeholder:text-muted-foreground/70 placeholder:font-[inherit]",
                "shadow-[0_0_20px_-8px] shadow-cyan-500/20",
                "focus-visible:border-cyan-500/50 focus-visible:ring-2 focus-visible:ring-cyan-500/25"
              )}
            />
          </div>
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
  const { selectedFont, engravingText, textLayout, imageLayout } = state
  const canvasRef = useRef<HTMLDivElement>(null)
  const textInnerRef = useRef<HTMLElement | null>(null)
  const imageInnerRef = useRef<HTMLElement | null>(null)
  const dragSessionRef = useRef<DragSession | null>(null)
  const [activeElement, setActiveElement] = useState<"text" | "image" | null>(null)
  const [dragMode, setDragMode] = useState<DragMode | null>(null)
  const [liveMmLabel, setLiveMmLabel] = useState<ElementMmSize | null>(null)
  const [textMm, setTextMm] = useState<ElementMmSize | null>(null)
  const [imageMm, setImageMm] = useState<ElementMmSize | null>(null)
  const canvasStyle = MATERIAL_CANVAS_STYLES[material.id]
  const fontFamily = getLaserFontFamily(selectedFont)
  const workAreaLabel = `${workAreaMm.widthMm} x ${workAreaMm.heightMm} mm`

  const stateRef = useRef(state)
  stateRef.current = state

  const patchTextLayout = (patch: Partial<ElementLayout>) => {
    const canvas = canvasRef.current
    const next = { ...stateRef.current.textLayout, ...patch }
    if (patch.scale !== undefined && canvas && textInnerRef.current) {
      next.scale = clampLayoutScaleToFit(
        canvas,
        textInnerRef.current,
        stateRef.current.textLayout,
        patch.scale
      )
    }
    if ((patch.x !== undefined || patch.y !== undefined) && canvas) {
      const clamped = clampLayoutPosition(
        canvas,
        textInnerRef.current,
        next.x,
        next.y
      )
      next.x = clamped.x
      next.y = clamped.y
    }
    onStateChange({ textLayout: next })
  }

  const patchImageLayout = (patch: Partial<ImageLayout>) => {
    const canvas = canvasRef.current
    const next = { ...stateRef.current.imageLayout, ...patch }
    if (patch.scale !== undefined && canvas && imageInnerRef.current) {
      next.scale = clampLayoutScaleToFit(
        canvas,
        imageInnerRef.current,
        stateRef.current.imageLayout,
        patch.scale
      )
    }
    if ((patch.x !== undefined || patch.y !== undefined) && canvas) {
      const clamped = clampLayoutPosition(
        canvas,
        imageInnerRef.current,
        next.x,
        next.y
      )
      next.x = clamped.x
      next.y = clamped.y
    }
    onStateChange({ imageLayout: next })
  }

  const applyLayout = useCallback(
    (target: ElementTarget, patch: Partial<ElementLayout>) => {
      const current = stateRef.current
      if (target === "text") {
        onStateChange({ textLayout: { ...current.textLayout, ...patch } })
      } else {
        onStateChange({ imageLayout: { ...current.imageLayout, ...patch } })
      }
    },
    [onStateChange]
  )

  const updateMetrics = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const current = stateRef.current
    let textSize: ElementMmSize | null = null
    let imageSize: ElementMmSize | null = null

    if (current.engravingText.trim() && textInnerRef.current) {
      textSize = measureElementMm(canvas, textInnerRef.current, workAreaMm)
    }
    if (current.imageLayout.src && imageInnerRef.current) {
      imageSize = measureElementMm(canvas, imageInnerRef.current, workAreaMm)
    }

    const active =
      activeElement === "text"
        ? textSize
        : activeElement === "image"
          ? imageSize
          : textSize ?? imageSize

    const maxAreaMm2 = Math.max(
      textSize?.areaMm2 ?? 0,
      imageSize?.areaMm2 ?? 0
    )

    setTextMm(textSize)
    setImageMm(imageSize)
    setLiveMmLabel(active)
    onEngravingMetricsChange?.({
      text: textSize,
      image: imageSize,
      active,
      maxAreaMm2,
    })
  }, [activeElement, onEngravingMetricsChange, workAreaMm])

  useLayoutEffect(() => {
    updateMetrics()
  }, [
    updateMetrics,
    engravingText,
    textLayout,
    imageLayout,
    selectedFont,
    workAreaMm,
  ])

  const processDragMove = useCallback(
    (clientX: number, clientY: number, pointerId?: number) => {
      const session = dragSessionRef.current
      if (!session) return
      if (pointerId !== undefined && session.pointerId !== pointerId) return

      const canvas = canvasRef.current
      if (!canvas) return

      const { startLayout, mode, target } = session

      if (mode === "move") {
        const start = getCanvasPoint(
          canvas,
          session.startClientX,
          session.startClientY
        )
        const now = getCanvasPoint(canvas, clientX, clientY)
        const rawX = startLayout.x + (now.percentX - start.percentX)
        const rawY = startLayout.y + (now.percentY - start.percentY)
        const innerEl =
          target === "text" ? textInnerRef.current : imageInnerRef.current
        const clamped = clampLayoutPosition(canvas, innerEl, rawX, rawY)
        applyLayout(target, clamped)
        return
      }

      if (mode === "resize") {
        const center = getElementCenterPx(canvas, startLayout)
        const dist = Math.hypot(clientX - center.x, clientY - center.y) || 1
        const rawScale = (dist / session.startDistance) * startLayout.scale
        const innerEl =
          target === "text" ? textInnerRef.current : imageInnerRef.current
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
  // touchmove (passive: false) + preventDefault stoppt Mobile-Seiten-Scroll.
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
      // Mit PointerEvents liefert pointermove die Logik; Touch blockiert nur Scroll.
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
    setActiveElement(session.target)
    setDragMode(session.mode)
  }, [])

  const canvasFontStyle = getLaserFontStyle(selectedFont, "canvas")

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
      onStateChange({
        imageLayout: {
          ...stateRef.current.imageLayout,
          src: (event.target?.result as string) ?? null,
          scale: 1,
          rotation: 0,
        },
      })
      setActiveElement("image")
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  return (
    <Card className="relative isolate rounded-xl border-cyan-500/20 bg-card/50 shadow-lg shadow-cyan-500/5">
      <CardContent className="relative flex flex-col gap-0 p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            <h3 className="font-bold">Live-Vorschau</h3>
          </div>
          <Badge variant="outline" className="shrink-0 border-cyan-500/30 text-cyan-500">
            {workAreaLabel}
          </Badge>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          Innen ziehen = verschieben · Griff oben = drehen · Griff unten rechts =
          Groesse. Alles bleibt innerhalb von {workAreaLabel}.
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
            if (e.target === e.currentTarget) setActiveElement(null)
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

          {imageLayout.src && (
            <InteractiveCanvasElement
              target="image"
              layout={imageLayout}
              isActive={activeElement === "image"}
              isMoving={dragMode === "move" && activeElement === "image"}
              canvasRef={canvasRef}
              onSelect={() => setActiveElement("image")}
              onDragStart={startDragSession}
              onInnerRef={(el) => {
                imageInnerRef.current = el
              }}
              className="z-10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageLayout.src}
                alt="Logo-Vorschau"
                className={cn(
                  "max-h-32 w-auto rounded opacity-90 drop-shadow-lg grayscale",
                  CANVAS_TOUCH_LOCK_CLASS
                )}
                style={CANVAS_TOUCH_LOCK_STYLE}
                draggable={false}
              />
            </InteractiveCanvasElement>
          )}

          {engravingText.trim() && (
            <InteractiveCanvasElement
              key={`text-${selectedFont}`}
              target="text"
              layout={textLayout}
              isActive={activeElement === "text"}
              isMoving={dragMode === "move" && activeElement === "text"}
              canvasRef={canvasRef}
              onSelect={() => setActiveElement("text")}
              onDragStart={startDragSession}
              onInnerRef={(el) => {
                textInnerRef.current = el
              }}
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
              {engravingText}
            </InteractiveCanvasElement>
          )}

          {!engravingText.trim() && !imageLayout.src && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-muted-foreground">
              <Type className="mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">Text eingeben oder Logo hochladen</p>
              <p className="mt-1 text-xs opacity-70">Verschieben, skalieren, drehen</p>
            </div>
          )}
        </div>

        <div className="relative z-0 mt-4 space-y-4 border-t border-border/50 pt-4">
          {liveMmLabel && (engravingText.trim() || imageLayout.src) && (
            <p className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-center font-mono text-xs text-muted-foreground">
              Gravur-Groesse:{" "}
              <span className="font-semibold text-foreground">
                {liveMmLabel.widthMm.toFixed(1)} x {liveMmLabel.heightMm.toFixed(1)} mm
              </span>
              <span className="mx-1 text-border">·</span>
              {liveMmLabel.areaMm2.toFixed(0)} mm²
            </p>
          )}

          {activeElement === "text" && engravingText.trim() && (
            <ElementTransformControls
              label="Text bearbeiten"
              layout={textLayout}
              onChange={patchTextLayout}
              sizeMm={textMm}
              workAreaMm={workAreaMm}
            />
          )}

          {activeElement === "image" && imageLayout.src && (
            <ElementTransformControls
              label="Bild / Logo bearbeiten"
              layout={imageLayout}
              onChange={patchImageLayout}
              sizeMm={imageMm}
              workAreaMm={workAreaMm}
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
              Bild / Logo hochladen
            </span>
          </label>
          {imageLayout.src && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                onStateChange({ imageLayout: { ...DEFAULT_IMAGE_LAYOUT } })
                if (activeElement === "image") setActiveElement(null)
              }}
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Bild entfernen
            </Button>
          )}
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
  varianten = [],
  customizationBackgroundUrl,
  onEngravingMetricsChange,
  previewSurfaceRef,
}: LaserDesignerStudioProps) {
  if (column === "preview") {
    return (
      <LaserDesignerPreview
        material={material}
        state={state}
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
      productName={productName}
      state={state}
      onStateChange={onStateChange}
      showMaterialCard={showMaterialCard}
      showVariantPicker={showVariantPicker}
      varianten={varianten}
    />
  )
}
