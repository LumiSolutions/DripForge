import type { ElementLayout } from "@/lib/dripforge/laser-design"
import {
  ABSOLUTE_MAX_LAYOUT_SCALE,
  clampScale,
  MIN_LAYOUT_SCALE,
} from "@/lib/dripforge/laser-design"
import type { WorkAreaMm } from "@/lib/dripforge/laser-work-area"

/** Gestrichelter Gravurrahmen: inset 6% → nutzbare Fläche 88%. */
export const ENGRAVING_FRAME_USABLE_FRACTION = 0.88

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

/**
 * Maximaler Scale, damit das Element die Gravurfläche (gestrichelt) in
 * Breite oder Höhe zu 100% ausfüllt — ohne Seitenverhältnis-Verzerrung.
 */
export function computeMaxScaleToFitBounds(
  canvasEl: HTMLDivElement,
  elementEl: HTMLElement,
  layout: ElementLayout,
  usableFraction: number = ENGRAVING_FRAME_USABLE_FRACTION
): number {
  const canvasRect = canvasEl.getBoundingClientRect()
  const elementRect = elementEl.getBoundingClientRect()
  if (canvasRect.width <= 0 || canvasRect.height <= 0 || layout.scale <= 0) {
    return layout.scale
  }

  const baseW = elementRect.width / layout.scale
  const baseH = elementRect.height / layout.scale
  if (baseW <= 0 || baseH <= 0) return layout.scale

  const maxW = canvasRect.width * usableFraction
  const maxH = canvasRect.height * usableFraction
  const maxScale = Math.min(maxW / baseW, maxH / baseH, ABSOLUTE_MAX_LAYOUT_SCALE)
  return Math.max(MIN_LAYOUT_SCALE, maxScale)
}

/** Skaliert auf Fit-to-Bounds (Maximieren). */
export function fitLayoutScaleToBounds(
  canvasEl: HTMLDivElement,
  elementEl: HTMLElement,
  layout: ElementLayout,
  usableFraction: number = ENGRAVING_FRAME_USABLE_FRACTION
): number {
  return computeMaxScaleToFitBounds(canvasEl, elementEl, layout, usableFraction)
}

export function clampLayoutScaleToFit(
  canvasEl: HTMLDivElement,
  elementEl: HTMLElement | null,
  layout: ElementLayout,
  scale: number,
  usableFraction: number = ENGRAVING_FRAME_USABLE_FRACTION
): number {
  const maxScale = elementEl
    ? computeMaxScaleToFitBounds(canvasEl, elementEl, layout, usableFraction)
    : ABSOLUTE_MAX_LAYOUT_SCALE
  return clampScale(scale, maxScale)
}

export function scaleForTargetWidthMm(
  currentScale: number,
  currentWidthMm: number,
  targetWidthMm: number,
  maxWidthMm: number,
  maxScale: number = ABSOLUTE_MAX_LAYOUT_SCALE
): number {
  if (currentWidthMm <= 0 || targetWidthMm <= 0) return currentScale
  const clampedTarget = Math.min(Math.max(targetWidthMm, 1), maxWidthMm)
  return clampScale(currentScale * (clampedTarget / currentWidthMm), maxScale)
}

export function scaleForTargetHeightMm(
  currentScale: number,
  currentHeightMm: number,
  targetHeightMm: number,
  maxHeightMm: number,
  maxScale: number = ABSOLUTE_MAX_LAYOUT_SCALE
): number {
  if (currentHeightMm <= 0 || targetHeightMm <= 0) return currentScale
  const clampedTarget = Math.min(Math.max(targetHeightMm, 1), maxHeightMm)
  return clampScale(currentScale * (clampedTarget / currentHeightMm), maxScale)
}
