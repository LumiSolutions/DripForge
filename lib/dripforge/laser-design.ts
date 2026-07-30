import type { CSSProperties } from "react"

export type { LaserFontId } from "@/lib/dripforge/laser-fonts"
export {
  DEFAULT_LASER_FONT_ID,
  getLaserFontDropdownStyle,
  getLaserFontFamily,
  getLaserFontInputStyle,
  getLaserFontOption,
  getLaserFontStyle,
  LASER_FONT_OPTIONS,
} from "@/lib/dripforge/laser-fonts"

export type ElementLayout = {
  x: number
  y: number
  scale: number
  rotation: number
}

export type ImageLayout = ElementLayout & {
  src: string | null
}

export const DEFAULT_TEXT_LAYOUT: ElementLayout = {
  x: 50,
  y: 62,
  scale: 1,
  rotation: 0,
}

export const DEFAULT_IMAGE_LAYOUT: ImageLayout = {
  x: 50,
  y: 38,
  scale: 1,
  rotation: 0,
  src: null,
}

export function elementTransformStyle(layout: ElementLayout): CSSProperties {
  return {
    left: `${layout.x}%`,
    top: `${layout.y}%`,
    transform: `translate(-50%, -50%) scale(${layout.scale}) rotate(${layout.rotation}deg)`,
  }
}

export function normalizeRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

/** Winkel in Grad von Punkt (px) zum Zentrum — 0° = oben */
export function pointerAngleDegrees(
  centerX: number,
  centerY: number,
  clientX: number,
  clientY: number
): number {
  const rad = Math.atan2(clientY - centerY, clientX - centerX)
  return normalizeRotation((rad * 180) / Math.PI + 90)
}

/** Absolute Sicherheitsgrenze — der Slider nutzt Fit-to-Bounds als echtes Maximum. */
export const MIN_LAYOUT_SCALE = 0.3
export const ABSOLUTE_MAX_LAYOUT_SCALE = 50

/** @deprecated Harte 3×-Grenze entfernt — Fit-to-Bounds gilt. */
export const LEGACY_MAX_LAYOUT_SCALE = 3

export function clampScale(scale: number, maxScale = ABSOLUTE_MAX_LAYOUT_SCALE): number {
  if (!Number.isFinite(scale)) return MIN_LAYOUT_SCALE
  return Math.max(MIN_LAYOUT_SCALE, Math.min(maxScale, scale))
}

export const MATERIAL_CANVAS_STYLES: Record<
  string,
  { surface: string; overlay: string; label: string }
> = {
  wood: {
    surface: "bg-gradient-to-br from-amber-900/70 via-amber-950/50 to-stone-900/60",
    overlay: "bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.12),transparent_50%)]",
    label: "Holzstruktur",
  },
  acrylic: {
    surface: "bg-gradient-to-br from-cyan-500/25 via-slate-800/90 to-indigo-900/70",
    overlay: "bg-[linear-gradient(135deg,rgba(255,255,255,0.15)_0%,transparent_40%,rgba(6,182,212,0.2)_100%)]",
    label: "Acryl-Glanz",
  },
  stone: {
    surface: "bg-gradient-to-br from-slate-600/80 via-slate-800/90 to-zinc-900/80",
    overlay: "bg-[radial-gradient(circle_at_70%_80%,rgba(148,163,184,0.2),transparent_55%)]",
    label: "Schiefer-Struktur",
  },
  leather: {
    surface: "bg-gradient-to-br from-orange-950/70 via-amber-950/50 to-stone-900/70",
    overlay: "bg-[radial-gradient(ellipse_at_center,rgba(180,83,9,0.15),transparent_60%)]",
    label: "Leder-Textur",
  },
  edelstahl: {
    surface: "bg-gradient-to-br from-zinc-300/30 via-slate-700/90 to-zinc-900/85",
    overlay:
      "bg-[linear-gradient(120deg,rgba(255,255,255,0.22)_0%,transparent_35%,rgba(148,163,184,0.18)_70%,transparent_100%)]",
    label: "Edelstahl-Oberfläche",
  },
}

const DEFAULT_CANVAS_STYLE = MATERIAL_CANVAS_STYLES.edelstahl

export function getMaterialCanvasStyle(materialId: string) {
  return MATERIAL_CANVAS_STYLES[materialId] ?? DEFAULT_CANVAS_STYLE
}

