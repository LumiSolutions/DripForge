"use client"

import dynamic from "next/dynamic"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { formatOptionalNumber, parseOptionalNumber } from "@/lib/admin/optional-number"
import { cn } from "@/lib/utils"

const Product3DPreview = dynamic(
  () =>
    import("@/components/dripforge/shared/product-3d-preview").then(
      (m) => m.Product3DPreview
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-square max-h-56 w-full items-center justify-center rounded-lg border border-border/50 bg-muted/30 text-xs text-muted-foreground">
        3D-Vorschau wird geladen…
      </div>
    ),
  }
)

export type RotationDeg = { x: number; y: number; z: number }

const PRESETS: Array<{ id: string; label: string; rotation: RotationDeg }> = [
  { id: "flat", label: "Flach hinlegen", rotation: { x: 0, y: 0, z: 0 } },
  { id: "stand", label: "Aufstellen", rotation: { x: -90, y: 0, z: 0 } },
  { id: "x90", label: "90° X", rotation: { x: 90, y: 0, z: 0 } },
  { id: "y90", label: "90° Y", rotation: { x: 0, y: 90, z: 0 } },
  { id: "z90", label: "90° Z", rotation: { x: 0, y: 0, z: 90 } },
  { id: "y180", label: "180° Y", rotation: { x: 0, y: 180, z: 0 } },
]

type AdminRotationPreviewProps = {
  rotation: RotationDeg | null | undefined
  onChange: (next: RotationDeg) => void
  modelUrl?: string | null
  className?: string
}

export function AdminRotationPreview({
  rotation,
  onChange,
  modelUrl,
  className,
}: AdminRotationPreviewProps) {
  const current: RotationDeg = {
    x: Number(rotation?.x) || 0,
    y: Number(rotation?.y) || 0,
    z: Number(rotation?.z) || 0,
  }

  const nudge = (axis: keyof RotationDeg, delta: number) => {
    onChange({
      ...current,
      [axis]: Math.round((current[axis] + delta) * 10) / 10,
    })
  }

  const setAxis = (axis: keyof RotationDeg, raw: string) => {
    const n = parseOptionalNumber(raw)
    onChange({
      ...current,
      [axis]: n ?? 0,
    })
  }

  return (
    <div className={cn("space-y-3 rounded-lg border border-border/50 p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className={cn("text-xs font-semibold", adminUi.labelMuted)}>
          Standard-Ausrichtung 3D-Vorschau
        </Label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1 text-xs"
          onClick={() => onChange({ x: 0, y: 0, z: 0 })}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Zurücksetzen
        </Button>
      </div>

      {modelUrl?.trim() ? (
        <Product3DPreview
          modelUrl={modelUrl.trim()}
          initialRotationDeg={current}
          className="max-h-56"
        />
      ) : (
        <div className="flex aspect-video max-h-40 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 text-center text-xs text-muted-foreground">
          STL/GLB hochladen, um die Ausrichtung live zu prüfen.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => onChange(preset.rotation)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["x", "y", "z"] as const).map((axis) => (
          <div key={axis} className="space-y-1.5">
            <Label className={cn("text-xs", adminUi.labelMuted)}>
              Rotation {axis.toUpperCase()}°
            </Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 w-9 shrink-0 px-0"
                onClick={() => nudge(axis, -15)}
                aria-label={`${axis} −15°`}
              >
                −
              </Button>
              <Input
                type="number"
                step="15"
                value={formatOptionalNumber(current[axis])}
                onChange={(e) => setAxis(axis, e.target.value)}
                className={adminUi.input}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 w-9 shrink-0 px-0"
                onClick={() => nudge(axis, 15)}
                aria-label={`${axis} +15°`}
              >
                +
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className={cn("text-xs", adminUi.muted)}>
        Orientierung beim Öffnen der Produktseite. Presets setzen die Gradwerte;
        Feinjustierung über ±15° oder Eingabe.
      </p>
    </div>
  )
}
