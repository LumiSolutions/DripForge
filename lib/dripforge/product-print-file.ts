/** Hilfen für Produkt-Druckdateien (STL/3MF/GCODE/…) am Warenkorb. */

const PRINT_EXT = /\.(stl|3mf|gcode|obj|glb|gltf)(\?|#|$)/i
const PREFERRED_PRINT_EXT = /\.(stl|3mf|gcode)(\?|#|$)/i

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

/**
 * Wählt die Produktions-/Modelldatei eines Shop-Produkts für die Bestellposition.
 * Bevorzugt .stl / .3mf / .gcode, fällt sonst auf modellDateiUrl / modelUrl zurück.
 */
export function resolveProductPrintFile(product: {
  name?: string
  modelUrl?: string | null
  modellDateiUrl?: string | null
}): { fileUrl: string; fileName: string } | null {
  const candidates = [product.modellDateiUrl, product.modelUrl]
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter((u) => u.length > 0 && (/^https?:\/\//i.test(u) || u.startsWith("/")))

  if (candidates.length === 0) return null

  const preferred =
    candidates.find((u) => PREFERRED_PRINT_EXT.test(u)) ?? candidates[0]

  const safeName = (product.name ?? "modell")
    .replace(/[^a-zA-Z0-9-_äöüÄÖÜß]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)

  return {
    fileUrl: preferred,
    fileName: filenameFromAssetUrl(preferred, `${safeName || "modell"}.stl`),
  }
}
