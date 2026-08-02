import * as THREE from "three"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import { DEFAULT_PRICING_CONFIG } from "@/lib/dripforge/pricing-config"
import { weightFromVolumeCm3 } from "@/lib/dripforge/print-calculator-engine"

export type ProductStlAnalysis = {
  length: number
  width: number
  height: number
  volumeCm3: number
  weightG: number
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Richtet die Bounding-Box so aus, dass die kleinste Achse = Höhe (Y) wird
 * (flach auf dem Druckbett), analog zum Custom-3D-Upload.
 */
function alignGeometryFlatOnBed(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox()
  let box = geometry.boundingBox
  if (!box) return
  let size = box.getSize(new THREE.Vector3())

  if (size.z > size.y + 1e-6) {
    geometry.rotateX(-Math.PI / 2)
    geometry.computeBoundingBox()
    box = geometry.boundingBox
    if (!box) return
    size = box.getSize(new THREE.Vector3())
  }

  const axes = (
    [
      { axis: "x" as const, value: size.x },
      { axis: "y" as const, value: size.y },
      { axis: "z" as const, value: size.z },
    ] as Array<{ axis: "x" | "y" | "z"; value: number }>
  ).sort((a, b) => a.value - b.value)

  const minAxis = axes[0]?.axis
  if (minAxis === "z") {
    geometry.rotateX(Math.PI / 2)
  } else if (minAxis === "x") {
    geometry.rotateZ(Math.PI / 2)
  }

  geometry.computeBoundingBox()
  box = geometry.boundingBox
  if (!box) return
  const center = box.getCenter(new THREE.Vector3())
  geometry.translate(-center.x, -center.y, -center.z)
  geometry.computeBoundingBox()
}

/**
 * Analysiert eine STL wie der Custom-Upload: Masse (mm), Bounding-Volumen (cm³),
 * geschätztes Filamentgewicht (PLA-Dichte × Infill).
 */
export async function analyzeProductStlFile(
  file: File,
  options?: { densityGPerCm3?: number; infillFactor?: number }
): Promise<ProductStlAnalysis> {
  const buffer = await file.arrayBuffer()
  const loader = new STLLoader()
  const geometry = loader.parse(buffer) as THREE.BufferGeometry
  alignGeometryFlatOnBed(geometry)

  const box = geometry.boundingBox
  if (!box) {
    geometry.dispose()
    throw new Error("STL-Bounding-Box konnte nicht berechnet werden.")
  }
  const size = box.getSize(new THREE.Vector3())
  // Konvention Shop: length=X, width=Z, height=Y (flach auf Bett)
  const length = Math.max(0, size.x)
  const width = Math.max(0, size.z)
  const height = Math.max(0, size.y)
  const volumeCm3 = (length * width * height) / 1000
  const density = options?.densityGPerCm3 ?? DEFAULT_PRICING_CONFIG.densityPLA
  const infill = options?.infillFactor ?? DEFAULT_PRICING_CONFIG.infillFactor
  const weightG = weightFromVolumeCm3(volumeCm3, density, infill)

  geometry.dispose()

  return {
    length: round1(length),
    width: round1(width),
    height: round1(height),
    volumeCm3: round1(volumeCm3),
    weightG: Math.max(0, Math.round(weightG)),
  }
}

export function isStlFileName(name: string): boolean {
  return /\.stl$/i.test(name.trim())
}
