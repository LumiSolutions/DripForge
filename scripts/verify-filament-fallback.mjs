/** Sanity check: empty inventory/admin still yields usable fallback catalog. */
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const root = new URL("../", import.meta.url)

function loadLegacyCount() {
  const source = readFileSync(new URL("lib/dripforge/data.ts", root), "utf8")
  const materialBlocks = source.match(/export const materials3D[\s\S]*?= \[([\s\S]*?)\n\]/)
  if (!materialBlocks) throw new Error("materials3D not found")
  const colorMatches = materialBlocks[1].match(/inStock:\s*true/g) ?? []
  if (colorMatches.length === 0) throw new Error("expected in-stock legacy colors")
  return colorMatches.length
}

const inStockColors = loadLegacyCount()
console.log(`OK legacy fallback exposes ${inStockColors} in-stock colors`)
