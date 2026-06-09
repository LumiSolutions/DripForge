export type Product3dModelFormat = "gltf" | "stl"

function isLoadableModelUrl(url: string | null | undefined): url is string {
  const trimmed = url?.trim()
  if (!trimmed) return false
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return false
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")
}

export function getProduct3dModelFormat(
  url: string | null | undefined
): Product3dModelFormat | null {
  if (!isLoadableModelUrl(url)) return null
  const path = url.split("?")[0]?.toLowerCase() ?? ""
  if (path.endsWith(".stl")) return "stl"
  if (path.endsWith(".glb") || path.endsWith(".gltf")) return "gltf"
  return null
}

/** Liefert die Admin-Modell-URL (GLB/GLTF/STL) oder null — kein Platzhalter-Fallback. */
export function resolveProductModelUrl(
  _productId: string,
  modelUrl?: string | null,
  modellDateiUrl?: string | null
): string | null {
  const fromAdmin = modellDateiUrl?.trim() || modelUrl?.trim()
  if (!fromAdmin) return null
  return getProduct3dModelFormat(fromAdmin) ? fromAdmin : null
}
