import * as THREE from "three"

/**
 * Dreht ein Objekt so, dass die kleinste Bounding-Box-Achse nach oben (Y) zeigt —
 * typische «flach auf dem Druckbett»-Ausrichtung für STL aus Slicern (Z-up).
 */
export function alignObjectFlatOnBed(object: THREE.Object3D): void {
  object.updateMatrixWorld(true)
  let box = new THREE.Box3().setFromObject(object)
  let size = box.getSize(new THREE.Vector3())

  // CAD/Slicer Z-up → Three.js Y-up
  if (size.z > size.y + 1e-6) {
    object.rotation.x -= Math.PI / 2
    object.updateMatrixWorld(true)
    box = new THREE.Box3().setFromObject(object)
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
  if (minAxis === "y") return

  if (minAxis === "z") {
    object.rotation.x += Math.PI / 2
  } else if (minAxis === "x") {
    object.rotation.z += Math.PI / 2
  }
  object.updateMatrixWorld(true)
}

/** Kippt das Modell um 90° um die X-Achse (Kunde: «Modell kippen»). */
export function tipObjectOnBed(object: THREE.Object3D): void {
  object.rotation.x += Math.PI / 2
  object.updateMatrixWorld(true)
}
