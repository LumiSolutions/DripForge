import type { Product } from "@/lib/dripforge/types"
import { getSaleBadgePercent } from "@/lib/dripforge/product-sale"

export function isProductOnSale(product: Product): boolean {
  if (product.sale) return true
  if (product.originalPrice != null && product.originalPrice > product.price) return true
  return getSaleBadgePercent(product) != null
}
