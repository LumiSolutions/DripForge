import { laserMaterials } from "@/lib/dripforge/data"
import {
  createMaterialId,
  MATERIAL_DOC_TYPE,
  type MaterialItem,
} from "@/lib/admin/material-types"
import { normalizeMaterialItem } from "@/lib/admin/cosmos-materials"

/** Stammdaten-Vorlagen für leeres Lasermaterial-Lager (Katalog → Lagerartikel). */
export function buildDefaultLaserStockMaterials(): MaterialItem[] {
  const now = new Date().toISOString()
  return laserMaterials.map((catalog) =>
    normalizeMaterialItem({
      id: createMaterialId(catalog.name),
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
