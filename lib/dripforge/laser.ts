import {
  matchCoreLaserMaterialId,
  resolveLaserMaterialById,
} from "@/lib/dripforge/laser-material-options"
import type { LaserMaterial, LaserMaterialId, Product } from "@/lib/dripforge/types"

export function resolveLaserMaterialId(product: Product): LaserMaterialId {
  const explicit = product.laserMaterialId?.trim()
  if (explicit) {
    return matchCoreLaserMaterialId(explicit) ?? explicit
  }

  const haystack = `${product.name} ${product.description}`.toLowerCase()
  const fromName = matchCoreLaserMaterialId(haystack)
  if (fromName) return fromName
  return "wood"
}

export function getLaserMaterialForProduct(product: Product): LaserMaterial {
  return resolveLaserMaterialById(resolveLaserMaterialId(product))
}
