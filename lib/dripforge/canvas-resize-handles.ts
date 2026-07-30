import {
  clampScale,
  resolvedScaleXY,
  type ElementLayout,
} from "@/lib/dripforge/laser-design"

export type ResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"

export const RESIZE_HANDLES: ResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
]

export function resizeHandleClass(handle: ResizeHandle): string {
  // Kleine Griffe (12px) knapp ausserhalb der Selektionsbox
  switch (handle) {
    case "nw":
      return "cursor-nwse-resize -left-1 -top-1"
    case "n":
      return "cursor-ns-resize left-1/2 -top-1 -translate-x-1/2"
    case "ne":
      return "cursor-nesw-resize -right-1 -top-1"
    case "e":
      return "cursor-ew-resize -right-1 top-1/2 -translate-y-1/2"
    case "se":
      return "cursor-nwse-resize -right-1 -bottom-1"
    case "s":
      return "cursor-ns-resize left-1/2 -bottom-1 -translate-x-1/2"
    case "sw":
      return "cursor-nesw-resize -left-1 -bottom-1"
    case "w":
      return "cursor-ew-resize -left-1 top-1/2 -translate-y-1/2"
  }
}

/**
 * Berechnet neue scaleX/scaleY beim Ziehen eines Resize-Handles.
 * proportional=true → uniform aus Distanz zum Zentrum.
 */
export function computeResizeScales(args: {
  handle: ResizeHandle
  startLayout: ElementLayout
  centerClientX: number
  centerClientY: number
  startClientX: number
  startClientY: number
  clientX: number
  clientY: number
  startDistance: number
  proportional: boolean
  maxScale: number
}): { scale: number; scaleX: number; scaleY: number } {
  const { sx: startSx, sy: startSy } = resolvedScaleXY(args.startLayout)

  if (args.proportional) {
    const dist =
      Math.hypot(args.clientX - args.centerClientX, args.clientY - args.centerClientY) ||
      1
    const factor = dist / (args.startDistance || 1)
    const next = clampScale(startSx * factor, args.maxScale)
    return { scale: next, scaleX: next, scaleY: next }
  }

  const dx = args.clientX - args.centerClientX
  const dy = args.clientY - args.centerClientY
  const startDx = args.startClientX - args.centerClientX
  const startDy = args.startClientY - args.centerClientY

  let nextSx = startSx
  let nextSy = startSy

  const xFactor =
    Math.abs(startDx) > 2 ? Math.abs(dx) / Math.abs(startDx) : 1
  const yFactor =
    Math.abs(startDy) > 2 ? Math.abs(dy) / Math.abs(startDy) : 1

  switch (args.handle) {
    case "e":
    case "w":
      nextSx = clampScale(startSx * xFactor, args.maxScale)
      break
    case "n":
    case "s":
      nextSy = clampScale(startSy * yFactor, args.maxScale)
      break
    default:
      nextSx = clampScale(startSx * xFactor, args.maxScale)
      nextSy = clampScale(startSy * yFactor, args.maxScale)
      break
  }

  const uniform = (nextSx + nextSy) / 2
  return { scale: uniform, scaleX: nextSx, scaleY: nextSy }
}
