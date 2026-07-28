import * as THREE from "three"

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

/** Zentrieren, auf Viewport-Grösse skalieren, Unterkante auf Y = 0 */
export function prepareGltfScene(source: THREE.Object3D): PreparedGltfScene {
  const scene = source.clone(true)
  scene.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(scene)
  const center = box.getCenter(new THREE.Vector3())
  scene.position.sub(center)

  scene.updateMatrixWorld(true)
  const sizedBox = new THREE.Box3().setFromObject(scene)
  const size = sizedBox.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const fitScale = maxDim > 0 ? 100 / maxDim : 1
  scene.scale.setScalar(fitScale)

  scene.updateMatrixWorld(true)
  const groundedBox = new THREE.Box3().setFromObject(scene)
  scene.position.y -= groundedBox.min.y

  scene.updateMatrixWorld(true)
  const finalBox = new THREE.Box3().setFromObject(scene)
  const orbitCenterY = (finalBox.min.y + finalBox.max.y) / 2
  const finalSize = finalBox.getSize(new THREE.Vector3())

  return {
    scene,
    orbitCenterY,
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
