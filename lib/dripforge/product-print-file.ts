/** Hilfen für Produkt-Druckdateien (STL/3MF/GCODE) am Warenkorb. */

const PRINT_EXT = /\.(stl|3mf|gcode)(\?|#|$)/i
const VIEWER_EXT = /\.(glb|gltf|obj)(\?|#|$)/i

export function filenameFromAssetUrl(
  url: string,
  fallback = "modell.stl"
): string {
  try {
    const path = new URL(url, "https://local.invalid").pathname
    const base = decodeURIComponent(path.split("/").pop() ?? "")
    if (base && PRINT_EXT.test(base)) return base
  } catch {
    /* ignore */
  }
  const bare = url.split("?")[0]?.split("/").pop()
  if (bare && PRINT_EXT.test(bare)) return decodeURIComponent(bare)
  return fallback
}

function isLoadableUrl(u: string): boolean {
  return u.length > 0 && (/^https?:\/\//i.test(u) || u.startsWith("/"))
}

/** Ersetzt Viewer-Endung (.glb/.gltf/.obj) durch .stl am gleichen Pfad. */
export function guessStlSiblingUrl(url: string): string | null {
  try {
    const parsed = new URL(url, "https://local.invalid")
    const nextPath = parsed.pathname.replace(/\.(glb|gltf|obj)(\.gz)?$/i, ".stl")
    if (nextPath === parsed.pathname) return null
    parsed.pathname = nextPath
    // relative / absolute beibehalten
    if (url.startsWith("/") && !/^https?:\/\//i.test(url)) {
      return `${nextPath}${parsed.search}${parsed.hash}`
    }
    return parsed.toString()
  } catch {
    const cleaned = url.split("?")[0]?.split("#")[0] ?? url
    if (!VIEWER_EXT.test(cleaned)) return null
    const stlPath = cleaned.replace(VIEWER_EXT, ".stl")
    const queryIdx = url.indexOf("?")
    const hashIdx = url.indexOf("#")
    let suffix = ""
    if (queryIdx >= 0) suffix = url.slice(queryIdx)
    else if (hashIdx >= 0) suffix = url.slice(hashIdx)
    return `${stlPath}${suffix}`
  }
}

/**
 * Wählt die Produktionsdatei (.stl / .3mf / .gcode) — nie reine Viewer-GLB/GLTF.
 * Versucht bei nur vorhandenem GLB einen Sibling-`.stl`-Pfad.
 */
export function resolveProductPrintFile(product: {
  name?: string
  modelUrl?: string | null
  modellDateiUrl?: string | null
}): { fileUrl: string; fileName: string } | null {
  const candidates = [product.modellDateiUrl, product.modelUrl]
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(isLoadableUrl)

  if (candidates.length === 0) return null

  const preferred = candidates.find((u) => PRINT_EXT.test(u))
  if (preferred) {
    return {
      fileUrl: preferred,
      fileName: filenameFromAssetUrl(preferred, "modell.stl"),
    }
  }

  for (const url of candidates) {
    const sibling = guessStlSiblingUrl(url)
    if (sibling && PRINT_EXT.test(sibling)) {
      const safeName = (product.name ?? "modell")
        .replace(/[^a-zA-Z0-9-_äöüÄÖÜß]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40)
      return {
        fileUrl: sibling,
        fileName: filenameFromAssetUrl(sibling, `${safeName || "modell"}.stl`),
      }
    }
  }

  // Kein STL/3MF/GCODE verfügbar — kein Download-Link (statt fälschlich GLB als STL)
  return null
}

export function isPrintProductionFile(urlOrName: string): boolean {
  return PRINT_EXT.test(urlOrName)
}

export function isViewerOnlyFile(urlOrName: string): boolean {
  return VIEWER_EXT.test(urlOrName) && !PRINT_EXT.test(urlOrName)
}

export function forceStlDownloadFilename(
  orderId: string,
  itemId: string,
  preferredName?: string | null
): string {
  const base = (preferredName ?? "").trim()
  if (base && PRINT_EXT.test(base)) {
    return base.replace(/[^\w.\-äöüÄÖÜß]+/gi, "_")
  }
  if (base && /\.(glb|gltf|obj)(\?.*)?$/i.test(base)) {
    return base.replace(/\.(glb|gltf|obj)(\?.*)?$/i, ".stl")
  }
  return `${orderId}-${itemId}-modell.stl`.replace(/[^\w.\-]+/g, "_")
}
