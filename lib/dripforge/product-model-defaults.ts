/**
 * Fallback-GLB bis ein Admin-Modell hinterlegt ist.
 * Spaeter: /models/default-placeholder.glb im public-Ordner.
 */
export const DEFAULT_PRODUCT_MODEL_URL =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Avocado/glTF-Binary/Avocado.glb"

/** Beispiel-URLs pro Shop-Produkt (Admin-Portal spaeter) */
export const PRODUCT_MODEL_URLS: Record<string, string> = {
  "1": "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Box/glTF-Binary/Box.glb",
  "2": "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb",
  "3": "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
  "4": "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Avocado/glTF-Binary/Avocado.glb",
}

export function isWebGltfModelUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim()
  if (!trimmed) return false
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return false
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("/")) return false
  const path = trimmed.split("?")[0]?.toLowerCase() ?? ""
  return path.endsWith(".glb") || path.endsWith(".gltf")
}

export function resolveProductModelUrl(
  productId: string,
  modelUrl?: string | null,
  modellDateiUrl?: string | null
): string {
  const fromAdmin = modellDateiUrl?.trim() || modelUrl?.trim()
  if (fromAdmin && isWebGltfModelUrl(fromAdmin)) return fromAdmin
  if (fromAdmin) {
    console.warn(
      `Shop: 3D-Modell "${fromAdmin}" ist kein GLB/GLTF — Fallback wird genutzt.`
    )
  }
  return PRODUCT_MODEL_URLS[productId] ?? DEFAULT_PRODUCT_MODEL_URL
}
