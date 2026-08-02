import type { FilamentMaterial } from "@/lib/dripforge/types"

/**
 * Filtert Shop-Filament-Tabs pro Produkt.
 * `undefined` / `null` = alle Material-Arten (Legacy / Default).
 * Explizites Array (auch leer) = nur diese IDs.
 */
export function filterFilamentMaterialsForProduct(
  materials: FilamentMaterial[],
  allowedIds?: string[] | null
): FilamentMaterial[] {
  if (allowedIds == null) return materials
  if (!Array.isArray(allowedIds)) return materials
  const allowed = new Set(
    allowedIds.map((id) => String(id).trim().toLowerCase()).filter(Boolean)
  )
  return materials.filter((m) => allowed.has(String(m.id).trim().toLowerCase()))
}

/** Normalisiert IDs; leeres Array bleibt leeres Array (explizit keine Arten). */
export function normalizeAllowedFilamentMaterialTypeIds(
  raw: unknown
): string[] | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!Array.isArray(raw)) return undefined
  const ids = raw
    .map((id) => (typeof id === "string" ? id.trim().toLowerCase() : ""))
    .filter(Boolean)
  const seen = new Set<string>()
  const unique: string[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    unique.push(id)
  }
  return unique
}
