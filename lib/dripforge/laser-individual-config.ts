import type { LaserMaterialId } from "@/lib/dripforge/types"

/** Basispreise CHF — spaeter aus Admin-Portal / Datenbank */
export const INDIVIDUAL_LASER_MATERIAL_BASE_PRICES: Record<LaserMaterialId, number> = {
  wood: 15,
  acrylic: 25,
  leather: 35,
  stone: 45,
}
