import type { Vector3 } from "three"
import { MAX_PRINT_DIMENSION_MM } from "@/lib/dripforge/print-limits"
import type { ModelDimensionsMm } from "@/lib/dripforge/load-3d-geometry"

/** Bei 100 % Skalierung entspricht die laengste Modellachse dieser Masse (mm). */
export const NORMALIZED_LONGEST_AXIS_MM = MAX_PRINT_DIMENSION_MM

export function getLongestAxisMm(size: Vector3): number {
  return Math.max(size.x, size.y, size.z)
}

/** Reale Masse nach 320-mm-Normierung und Kunden-Skalierung in Prozent. */
export function getRealDimensionsMm(
  sourceSizeMm: Vector3,
  scalePercent: number
): ModelDimensionsMm {
  const longest = getLongestAxisMm(sourceSizeMm)
  if (longest <= 0) {
    return { x: 0, y: 0, z: 0, volume: 0 }
  }

  const factor =
    (NORMALIZED_LONGEST_AXIS_MM / longest) * (scalePercent / 100)

  const x = sourceSizeMm.x * factor
  const y = sourceSizeMm.y * factor
  const z = sourceSizeMm.z * factor

  return {
    x,
    y,
    z,
    volume: (x * y * z) / 1000,
  }
}

export function getLongestAxisAtScale(
  sourceSizeMm: Vector3,
  scalePercent: number
): number {
  const longest = getLongestAxisMm(sourceSizeMm)
  if (longest <= 0) return 0
  return NORMALIZED_LONGEST_AXIS_MM * (scalePercent / 100)
}

export function scalePercentFromLongestAxis(targetLongestMm: number): number {
  return (targetLongestMm / NORMALIZED_LONGEST_AXIS_MM) * 100
}
