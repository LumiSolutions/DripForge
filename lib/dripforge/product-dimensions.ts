import type { Product, ProductDimensionsMm } from "@/lib/dripforge/types"

function safeAxis(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function formatProductDimensionsText(
  dims: ProductDimensionsMm | null | undefined
): string {
  const length = safeAxis(dims?.length, 0)
  const width = safeAxis(dims?.width, 0)
  const height = safeAxis(dims?.height, 0)
  return `${length.toFixed(1)} × ${width.toFixed(1)} × ${height.toFixed(1)} mm`
}

export function formatProductVolume(
  volumen: number | null | undefined,
  einheit: Product["volumenEinheit"] = "cm3"
): string {
  const value = safeAxis(volumen, 0)
  const unitLabel = einheit === "mm3" ? "mm³" : "cm³"
  return `${value.toFixed(1)} ${unitLabel}`
}

export function formatProductWeight(gewicht: number | null | undefined): string {
  return `${Math.round(safeAxis(gewicht, 0))} g`
}

/** Fuer 3D-Bemaßung: X = Länge, Y = Höhe, Z = Breite */
export function productDimensionsToViewerMm(dims: ProductDimensionsMm): {
  x: number
  y: number
  z: number
} {
  return {
    x: dims.length,
    y: dims.height,
    z: dims.width,
  }
}
