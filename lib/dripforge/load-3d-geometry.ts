import * as THREE from "three"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { getLongestAxisMm } from "@/lib/dripforge/model-scale"

const stlLoader = new STLLoader()
const objLoader = new OBJLoader()
const gltfLoader = new GLTFLoader()

export type ModelDimensionsMm = {
  x: number
  y: number
  z: number
  volume: number
}

export type ModelMeshPart = {
  geometry: THREE.BufferGeometry
  partIndex: number
  /** Original-Material aus der Datei (GLTF/OBJ) */
  material?: THREE.Material | THREE.Material[] | null
  /** Vertex-Farben in der Geometrie */
  hasVertexColors?: boolean
  /** Farbe nicht durch Filamentauswahl ueberschreiben */
  preserveOriginalAppearance?: boolean
}

export type LoadedIndividualModel = {
  parts: ModelMeshPart[]
  /** Vollstaendige Szene mit Texturen/Materialien (GLTF) */
  nativeScene?: THREE.Object3D | null
  /** Modell bringt eigene Farben/Texturen mit */
  hasEmbeddedColors: boolean
  /** Bounding-Box-Grösse der Datei in mm (vor Viewer-Normierung) */
  sourceSizeMm: THREE.Vector3
  longestAxisMm: number
}

function cloneMaterial(
  material: THREE.Material | THREE.Material[]
): THREE.Material | THREE.Material[] {
  return Array.isArray(material)
    ? material.map((m) => m.clone())
    : material.clone()
}

function geometryHasVertexColors(geometry: THREE.BufferGeometry): boolean {
  const colors = geometry.attributes.color
  return Boolean(colors && colors.count > 0)
}

function materialHasEmbeddedAppearance(material: THREE.Material): boolean {
  const mat = material as THREE.MeshStandardMaterial
  if (mat.map || mat.normalMap || mat.roughnessMap || mat.metalnessMap) {
    return true
  }
  if (mat.color) {
    const hex = mat.color.getHex()
    if (hex !== 0xffffff && hex !== 0xcccccc && hex !== 0x808080) {
      return true
    }
  }
  return false
}

function meshHasEmbeddedAppearance(mesh: THREE.Mesh): boolean {
  if (geometryHasVertexColors(mesh.geometry)) return true

  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material]

  return materials.some(
    (m) => m && materialHasEmbeddedAppearance(m as THREE.Material)
  )
}

function detectEmbeddedColorsFromMeshes(meshes: THREE.Mesh[]): boolean {
  if (meshes.length === 0) return false

  const distinctColors = new Set<string>()
  let hasVertex = false
  let hasTexture = false

  for (const mesh of meshes) {
    if (geometryHasVertexColors(mesh.geometry)) hasVertex = true
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]
    for (const material of materials) {
      if (!material) continue
      const std = material as THREE.MeshStandardMaterial
      if (std.map || std.normalMap) hasTexture = true
      if (std.color) distinctColors.add(std.color.getHexString())
    }
  }

  return hasVertex || hasTexture || distinctColors.size > 1
}

function dropToFloor(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return
  geometry.translate(0, -box.min.y, 0)
  geometry.computeBoundingBox()
}

function getCombinedBoundingSize(
  geometries: THREE.BufferGeometry[]
): THREE.Vector3 {
  const box = new THREE.Box3()
  for (const geometry of geometries) {
    geometry.computeBoundingBox()
    if (geometry.boundingBox) box.union(geometry.boundingBox)
  }
  return box.getSize(new THREE.Vector3())
}

function getObjectBoundingSize(object: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(object)
  return box.getSize(new THREE.Vector3())
}

function centerGeometries(geometries: THREE.BufferGeometry[]): void {
  const box = new THREE.Box3()
  for (const geometry of geometries) {
    geometry.computeBoundingBox()
    if (geometry.boundingBox) box.union(geometry.boundingBox)
  }
  const center = box.getCenter(new THREE.Vector3())
  for (const geometry of geometries) {
    geometry.translate(-center.x, -center.y, -center.z)
  }
}

function centerObject3D(object: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  object.position.sub(center)
  object.updateMatrixWorld(true)
}

function rotateGeometriesXIfNeeded(geometries: THREE.BufferGeometry[]): void {
  const size = getCombinedBoundingSize(geometries)
  if (size.z > size.y) {
    for (const geometry of geometries) {
      geometry.rotateX(-Math.PI / 2)
    }
  }
}

function rotateObjectXIfNeeded(object: THREE.Object3D): void {
  const size = getObjectBoundingSize(object)
  if (size.z > size.y) {
    object.rotation.x = -Math.PI / 2
    object.updateMatrixWorld(true)
  }
}

function scaleGeometriesToViewport(geometries: THREE.BufferGeometry[]): void {
  const size = getCombinedBoundingSize(geometries)
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim <= 0) return
  const fitScale = 100 / maxDim
  for (const geometry of geometries) {
    geometry.scale(fitScale, fitScale, fitScale)
    geometry.computeVertexNormals()
    dropToFloor(geometry)
  }
}

function scaleObjectToViewport(object: THREE.Object3D): void {
  const size = getObjectBoundingSize(object)
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim <= 0) return
  const fitScale = 100 / maxDim
  object.scale.setScalar(fitScale)
  object.updateMatrixWorld(true)
  // Nach Skalierung erneut zentrieren (position driftet sonst aus dem Viewer)
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  object.position.sub(center)
  object.updateMatrixWorld(true)
  const grounded = new THREE.Box3().setFromObject(object)
  object.position.y -= grounded.min.y
  object.updateMatrixWorld(true)
}

function extractMeshesFromObject(object: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child)
  })
  return meshes
}

function partsFromMeshes(
  meshes: THREE.Mesh[],
  hasEmbeddedColors: boolean
): ModelMeshPart[] {
  return meshes.map((mesh, partIndex) => {
    const geometry = mesh.geometry.clone()
    mesh.updateWorldMatrix(true, false)
    geometry.applyMatrix4(mesh.matrixWorld)

    const hasVertexColors = geometryHasVertexColors(geometry)
    const preserve =
      hasEmbeddedColors &&
      (hasVertexColors || meshHasEmbeddedAppearance(mesh))

    return {
      geometry,
      partIndex,
      material: preserve
        ? cloneMaterial(mesh.material as THREE.Material | THREE.Material[])
        : null,
      hasVertexColors,
      preserveOriginalAppearance: preserve,
    }
  })
}

function preparePartsForDisplay(
  rawParts: THREE.BufferGeometry[],
  hasEmbeddedColors = false
): LoadedIndividualModel {
  const parts = rawParts.map((g) => g.clone())

  centerGeometries(parts)
  rotateGeometriesXIfNeeded(parts)

  const sourceSizeMm = getCombinedBoundingSize(parts)
  const longestAxisMm = getLongestAxisMm(sourceSizeMm)

  scaleGeometriesToViewport(parts)

  const embedded =
    hasEmbeddedColors ||
    parts.some((geometry) => geometryHasVertexColors(geometry))

  return {
    parts: parts.map((geometry, partIndex) => ({
      geometry,
      partIndex,
      hasVertexColors: geometryHasVertexColors(geometry),
      preserveOriginalAppearance: embedded && geometryHasVertexColors(geometry),
    })),
    nativeScene: null,
    hasEmbeddedColors: embedded,
    sourceSizeMm,
    longestAxisMm,
  }
}

function prepareNativeScene(
  source: THREE.Object3D,
  hasEmbeddedColors: boolean
): LoadedIndividualModel {
  const scene = source.clone(true)
  scene.updateMatrixWorld(true)

  centerObject3D(scene)
  rotateObjectXIfNeeded(scene)

  const sourceSizeMm = getObjectBoundingSize(scene)
  const longestAxisMm = getLongestAxisMm(sourceSizeMm)

  scaleObjectToViewport(scene)

  const meshes = extractMeshesFromObject(scene)
  const parts = partsFromMeshes(meshes, hasEmbeddedColors)

  return {
    parts,
    nativeScene: hasEmbeddedColors ? scene : null,
    hasEmbeddedColors,
    sourceSizeMm,
    longestAxisMm,
  }
}

function geometriesFromObject3D(object: THREE.Object3D): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = []

  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const cloned = child.geometry.clone()
      child.updateMatrixWorld(true)
      cloned.applyMatrix4(child.matrixWorld)
      geometries.push(cloned)
    }
  })

  if (geometries.length === 0) {
    throw new Error("Keine druckbare Geometrie in der Datei gefunden.")
  }

  return geometries
}

function meshesFromObject3D(object: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const mesh = child.clone() as THREE.Mesh
      mesh.geometry = child.geometry.clone()
      mesh.updateWorldMatrix(true, false)
      mesh.geometry.applyMatrix4(mesh.matrixWorld)
      mesh.position.set(0, 0, 0)
      mesh.rotation.set(0, 0, 0)
      mesh.scale.set(1, 1, 1)
      meshes.push(mesh)
    }
  })
  if (meshes.length === 0) {
    throw new Error("Keine druckbare Geometrie in der Datei gefunden.")
  }
  return meshes
}

function loadObjModel(text: string): LoadedIndividualModel {
  const group = objLoader.parse(text)
  const meshes = meshesFromObject3D(group)
  const hasEmbeddedColors = detectEmbeddedColorsFromMeshes(meshes)

  if (hasEmbeddedColors) {
    const tempGroup = new THREE.Group()
    meshes.forEach((m) => tempGroup.add(m))
    return prepareNativeScene(tempGroup, true)
  }

  return preparePartsForDisplay(
    meshes.map((m) => m.geometry),
    false
  )
}

function parseGltfBuffer(buffer: ArrayBuffer): Promise<{ scene: THREE.Group }> {
  return new Promise((resolve, reject) => {
    gltfLoader.parse(
      buffer,
      "",
      (gltf) => resolve(gltf),
      (error) => reject(error)
    )
  })
}

async function loadGltfModel(buffer: ArrayBuffer): Promise<LoadedIndividualModel> {
  const gltf = await parseGltfBuffer(buffer)
  const meshes = extractMeshesFromObject(gltf.scene)
  const hasEmbeddedColors = detectEmbeddedColorsFromMeshes(meshes)

  if (hasEmbeddedColors) {
    return prepareNativeScene(gltf.scene, true)
  }

  return preparePartsForDisplay(geometriesFromObject3D(gltf.scene), false)
}

export function loadModelFromFile(
  fileName: string,
  buffer: ArrayBuffer
): LoadedIndividualModel {
  const extension = fileName.split(".").pop()?.toLowerCase()

  if (extension === "stl") {
    const geometry = stlLoader.parse(buffer)
    const hasVertexColors = geometryHasVertexColors(geometry)
    return preparePartsForDisplay([geometry], hasVertexColors)
  }

  if (extension === "obj") {
    const text = new TextDecoder().decode(buffer)
    return loadObjModel(text)
  }

  throw new Error(
    "Synchroner Loader unterstuetzt STL und OBJ. GLTF/GLB bitte async laden."
  )
}

export async function loadModelFromFileAsync(
  fileName: string,
  buffer: ArrayBuffer
): Promise<LoadedIndividualModel> {
  const extension = fileName.split(".").pop()?.toLowerCase()

  if (extension === "glb" || extension === "gltf") {
    return loadGltfModel(buffer)
  }

  return loadModelFromFile(fileName, buffer)
}

export function disposeLoadedModel(model: LoadedIndividualModel): void {
  if (model.nativeScene) {
    model.nativeScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.geometry?.dispose()
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material]
      for (const material of materials) {
        if (!material) continue
        material.dispose()
        const std = material as THREE.MeshStandardMaterial
        std.map?.dispose()
        std.normalMap?.dispose()
      }
    })
    return
  }

  for (const part of model.parts) {
    part.geometry.dispose()
    if (part.material) {
      const materials = Array.isArray(part.material)
        ? part.material
        : [part.material]
      for (const material of materials) {
        material.dispose()
      }
    }
  }
}

/** Abwaertskompatibel: ein zusammengefuegtes Mesh */
export function loadGeometryFromFile(
  fileName: string,
  buffer: ArrayBuffer
): { geometry: THREE.BufferGeometry; sizeMm: THREE.Vector3 } {
  const loaded = loadModelFromFile(fileName, buffer)

  if (loaded.parts.length === 1) {
    return {
      geometry: loaded.parts[0].geometry,
      sizeMm: loaded.sourceSizeMm.clone(),
    }
  }

  const toMerge = loaded.parts.map((p) => p.geometry.clone())
  const merged = mergeGeometries(toMerge, false)
  if (!merged) {
    throw new Error("Geometrien konnten nicht zusammengefuehrt werden.")
  }
  toMerge.forEach((g) => g.dispose())

  return {
    geometry: merged,
    sizeMm: loaded.sourceSizeMm.clone(),
  }
}

export function getScaledDimensionsMm(
  sizeMm: THREE.Vector3,
  scaleFactor: number
): ModelDimensionsMm {
  const x = sizeMm.x * scaleFactor
  const y = sizeMm.y * scaleFactor
  const z = sizeMm.z * scaleFactor
  const volume = (x * y * z) / 1000

  return { x, y, z, volume }
}

export function getGeometryOrbitTarget(
  geometry: THREE.BufferGeometry,
  scaleFactor = 1
): [number, number, number] {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return [0, 50 * scaleFactor, 0]
  const centerY = ((box.min.y + box.max.y) / 2) * scaleFactor
  return [0, centerY, 0]
}

export function getPartsOrbitTarget(
  parts: ModelMeshPart[],
  scaleFactor = 1
): [number, number, number] {
  if (parts.length === 0) return [0, 50 * scaleFactor, 0]
  const box = new THREE.Box3()
  for (const { geometry } of parts) {
    geometry.computeBoundingBox()
    if (geometry.boundingBox) box.union(geometry.boundingBox)
  }
  const centerY = ((box.min.y + box.max.y) / 2) * scaleFactor
  return [0, centerY, 0]
}

export function getObjectOrbitTarget(
  object: THREE.Object3D,
  scaleFactor = 1
): [number, number, number] {
  const box = new THREE.Box3().setFromObject(object)
  const centerY = ((box.min.y + box.max.y) / 2) * scaleFactor
  return [0, centerY, 0]
}

export function getDimensionGeometryFromParts(
  parts: ModelMeshPart[]
): THREE.BufferGeometry | null {
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0].geometry

  const clones = parts.map((p) => p.geometry.clone())
  const merged = mergeGeometries(clones, false)
  clones.forEach((g) => g.dispose())
  return merged
}

export function getDimensionGeometryFromObject(
  object: THREE.Object3D
): THREE.BufferGeometry | null {
  const geometries: THREE.BufferGeometry[] = []
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      geometries.push(child.geometry)
    }
  })
  if (geometries.length === 0) return null
  if (geometries.length === 1) return geometries[0]
  const merged = mergeGeometries(
    geometries.map((g) => g.clone()),
    false
  )
  return merged
}
