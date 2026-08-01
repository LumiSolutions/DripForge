import { laserMaterials } from "@/lib/dripforge/data"
import {
  MATERIAL_DOC_TYPE,
  type MaterialItem,
} from "@/lib/admin/material-types"
import { normalizeMaterialItem } from "@/lib/admin/cosmos-materials"

/** Stabile IDs — kein Date.now(), damit Seed idempotent upsertet und nie verdoppelt. */
function stableLaserSeedId(catalogId: string): string {
  const slug = catalogId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `mat-laser-seed-${slug || "item"}`
}

/** Stammdaten-Vorlagen für leeres Lasermaterial-Lager (Katalog → Lagerartikel). */
export function buildDefaultLaserStockMaterials(): MaterialItem[] {
  const now = new Date().toISOString()
  return laserMaterials.map((catalog) =>
    normalizeMaterialItem({
      id: stableLaserSeedId(catalog.id),
      docType: MATERIAL_DOC_TYPE,
      category: "lasermaterial",
      name: catalog.name,
      materialType: catalog.id,
      typ: catalog.types[0],
      stockUnit: "piece",
      stockAvailable: 0,
      stockReserved: 0,
      bemerkungen: catalog.description,
      updatedAt: now,
    })
  )
}
