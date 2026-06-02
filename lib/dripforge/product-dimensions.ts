import type { Product, ProductDimensionsMm } from "@/lib/dripforge/types"

export function formatProductDimensionsText(dims: ProductDimensionsMm): string {
  return `${dims.length.toFixed(1)} × ${dims.width.toFixed(1)} × ${dims.height.toFixed(1)} mm`
}

export function formatProductVolume(
  volumen: number,
  einheit: Product["volumenEinheit"] = "cm3"
): string {
  const unitLabel = einheit === "mm3" ? "mm³" : "cm³"
  return `${volumen.toFixed(1)} ${unitLabel}`
}

export function formatProductWeight(gewicht: number): string {
  return `${Math.round(gewicht)} g`
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
