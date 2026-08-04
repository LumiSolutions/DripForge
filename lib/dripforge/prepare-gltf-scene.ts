import * as THREE from "three"
import { alignObjectFlatOnBed } from "@/lib/dripforge/align-model-flat"

export type PreparedSceneSize = {
  x: number
  y: number
  z: number
}

export type PreparedGltfScene = {
  scene: THREE.Object3D
  orbitCenterY: number
  /** Abmessungen in Viewport-Einheiten bei 100 % Vorschau-Skalierung (max. Achse = 100) */
  sizeAt100: PreparedSceneSize
}

export type PrepareGltfSceneOptions = {
  /** STL/CAD flach aufs virtuelle Druckbett ausrichten (Default: true) */
  autoAlignFlat?: boolean
  /** Zusätzliche X-Kippung in 90°-Schritten (0–3) */
  tipSteps?: number
  /** Produktdefinierte Standard-Orientierung (Grad) für die Initialansicht */
  extraRotationDeg?: { x?: number; y?: number; z?: number } | null
}

/** Zentrieren, optional flach ausrichten, auf Viewport-Grösse skalieren, Unterkante auf Y = 0 */
export function prepareGltfScene(
  source: THREE.Object3D,
  options?: PrepareGltfSceneOptions
): PreparedGltfScene {
  const scene = source.clone(true)
  scene.updateMatrixWorld(true)

  if (options?.autoAlignFlat !== false) {
    alignObjectFlatOnBed(scene)
  }

  // Produktdefinierte Standard-Orientierung (Grad → Radiant) vor Kippen/Skalieren.
  const extra = options?.extraRotationDeg
  if (extra && (extra.x || extra.y || extra.z)) {
    const deg2rad = Math.PI / 180
    scene.rotation.x += (Number(extra.x) || 0) * deg2rad
    scene.rotation.y += (Number(extra.y) || 0) * deg2rad
    scene.rotation.z += (Number(extra.z) || 0) * deg2rad
    scene.updateMatrixWorld(true)
  }

  const tipSteps = Math.max(0, Math.round(options?.tipSteps ?? 0)) % 4
  if (tipSteps > 0) {
    scene.rotation.x += tipSteps * (Math.PI / 2)
    scene.updateMatrixWorld(true)
  }

  // Erst skalieren, dann per Bounding-Box zentrieren — sonst driftet das
  // Modell nach scale.setScalar (position bleibt unskaliert) aus dem Viewer.
  scene.updateMatrixWorld(true)
  const sizedBox = new THREE.Box3().setFromObject(scene)
  const size = sizedBox.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const fitScale = maxDim > 0 ? 100 / maxDim : 1
  scene.scale.setScalar(fitScale)

  scene.updateMatrixWorld(true)
  const centeredBox = new THREE.Box3().setFromObject(scene)
  const center = centeredBox.getCenter(new THREE.Vector3())
  scene.position.sub(center)

  scene.updateMatrixWorld(true)
  const groundedBox = new THREE.Box3().setFromObject(scene)
  scene.position.y -= groundedBox.min.y

  scene.updateMatrixWorld(true)
  const finalBox = new THREE.Box3().setFromObject(scene)
  // XZ erneut auf 0 halten (numerisch / nach Grounding)
  const finalCenter = finalBox.getCenter(new THREE.Vector3())
  scene.position.x -= finalCenter.x
  scene.position.z -= finalCenter.z

  scene.updateMatrixWorld(true)
  const orbitBox = new THREE.Box3().setFromObject(scene)
  const orbitCenter = orbitBox.getCenter(new THREE.Vector3())
  const finalSize = orbitBox.getSize(new THREE.Vector3())

  return {
    scene,
    orbitCenterY: orbitCenter.y,
    sizeAt100: { x: finalSize.x, y: finalSize.y, z: finalSize.z },
  }
}

/** Masse in mm: 1 Viewport-Einheit entspricht 1 mm bei 100 % Skalierung */
export function preparedSizeToDimensionsMm(
  sizeAt100: PreparedSceneSize,
  scaleFactor: number
): { x: number; y: number; z: number } {
  return {
    x: sizeAt100.x * scaleFactor,
    y: sizeAt100.y * scaleFactor,
    z: sizeAt100.z * scaleFactor,
  }
}

export function applyFilamentColorToScene(
  root: THREE.Object3D,
  colorHex: string
): void {
  const color = new THREE.Color(colorHex)
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material]

    for (const material of materials) {
      if (!material) continue
      const standard = material as THREE.MeshStandardMaterial
      if (standard.color) {
        standard.color.copy(color)
        standard.needsUpdate = true
      }
    }
  })
}
