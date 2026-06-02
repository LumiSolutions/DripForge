import type { ElementLayout } from "@/lib/dripforge/laser-design"
import { clampScale } from "@/lib/dripforge/laser-design"
import type { WorkAreaMm } from "@/lib/dripforge/laser-work-area"

export type ElementMmSize = {
  widthMm: number
  heightMm: number
  areaMm2: number
}

export function measureElementMm(
  canvasEl: HTMLDivElement,
  elementEl: HTMLElement,
  workArea: WorkAreaMm
): ElementMmSize {
  const canvasRect = canvasEl.getBoundingClientRect()
  const elementRect = elementEl.getBoundingClientRect()

  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return { widthMm: 0, heightMm: 0, areaMm2: 0 }
  }

  const widthMm = (elementRect.width / canvasRect.width) * workArea.widthMm
  const heightMm = (elementRect.height / canvasRect.height) * workArea.heightMm

  return {
    widthMm,
    heightMm,
    areaMm2: widthMm * heightMm,
  }
}

export function clampLayoutPosition(
  canvasEl: HTMLDivElement,
  elementEl: HTMLElement | null,
  x: number,
  y: number,
  paddingPercent = 2
): { x: number; y: number } {
  if (!elementEl) {
    return {
      x: Math.max(8, Math.min(92, x)),
      y: Math.max(8, Math.min(92, y)),
    }
  }

  const canvasRect = canvasEl.getBoundingClientRect()
  const elementRect = elementEl.getBoundingClientRect()
  const halfW = (elementRect.width / canvasRect.width) * 50
  const halfH = (elementRect.height / canvasRect.height) * 50
  const pad = paddingPercent

  return {
    x: Math.max(halfW + pad, Math.min(100 - halfW - pad, x)),
    y: Math.max(halfH + pad, Math.min(100 - halfH - pad, y)),
  }
}

export function clampLayoutScaleToFit(
  canvasEl: HTMLDivElement,
  elementEl: HTMLElement | null,
  layout: ElementLayout,
  scale: number
): number {
  const nextScale = clampScale(scale)
  if (!elementEl) return nextScale

  const canvasRect = canvasEl.getBoundingClientRect()
  const maxW = canvasRect.width * 0.92
  const maxH = canvasRect.height * 0.92

  const ratio = nextScale / layout.scale || 1
  const projectedW = elementEl.getBoundingClientRect().width * ratio
  const projectedH = elementEl.getBoundingClientRect().height * ratio

  if (projectedW <= maxW && projectedH <= maxH) return nextScale

  const shrinkW = maxW / projectedW
  const shrinkH = maxH / projectedH
  const shrink = Math.min(shrinkW, shrinkH, 1)

  return clampScale(nextScale * shrink)
}

export function scaleForTargetWidthMm(
  currentScale: number,
  currentWidthMm: number,
  targetWidthMm: number,
  maxWidthMm: number
): number {
  if (currentWidthMm <= 0 || targetWidthMm <= 0) return currentScale
  const clampedTarget = Math.min(Math.max(targetWidthMm, 1), maxWidthMm)
  return clampScale(currentScale * (clampedTarget / currentWidthMm))
}

export function scaleForTargetHeightMm(
  currentScale: number,
  currentHeightMm: number,
  targetHeightMm: number,
  maxHeightMm: number
): number {
  if (currentHeightMm <= 0 || targetHeightMm <= 0) return currentScale
  const clampedTarget = Math.min(Math.max(targetHeightMm, 1), maxHeightMm)
  return clampScale(currentScale * (clampedTarget / currentHeightMm))
}
