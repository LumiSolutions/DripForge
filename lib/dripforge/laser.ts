import { laserMaterials } from "@/lib/dripforge/data"
import type { LaserMaterial, LaserMaterialId, Product } from "@/lib/dripforge/types"

export function resolveLaserMaterialId(product: Product): LaserMaterialId {
  if (product.laserMaterialId) return product.laserMaterialId

  const haystack = `${product.name} ${product.description}`.toLowerCase()
  if (haystack.includes("acryl") || haystack.includes("led")) return "acrylic"
  if (haystack.includes("leder") || haystack.includes("schlüssel")) return "leather"
  if (haystack.includes("schiefer") || haystack.includes("stein")) return "stone"
  if (haystack.includes("holz") || haystack.includes("untersetzer")) return "wood"
  return "wood"
}

export function getLaserMaterialForProduct(product: Product): LaserMaterial {
  const id = resolveLaserMaterialId(product)
  return laserMaterials.find((m) => m.id === id) ?? laserMaterials[0]
}
