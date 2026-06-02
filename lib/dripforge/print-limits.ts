/** Maximaler Bauraum des Druckers (mm pro Achse). */
export const MAX_PRINT_DIMENSION_MM = 320

export function exceedsMaxPrintVolume(dimensions: {
  x: number
  y: number
  z: number
}): boolean {
  return (
    dimensions.x > MAX_PRINT_DIMENSION_MM ||
    dimensions.y > MAX_PRINT_DIMENSION_MM ||
    dimensions.z > MAX_PRINT_DIMENSION_MM
  )
}
