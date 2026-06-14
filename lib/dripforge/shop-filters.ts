import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import type { Product } from "@/lib/dripforge/types"
import { getSaleBadgePercent } from "@/lib/dripforge/product-sale"

export type ShopFilterId = "all" | "3d" | "laser" | "sale"

export type ShopFilterOption = {
  id: ShopFilterId
  label: string
}

export type ShopFilterLabels = Partial<Record<ShopFilterId, string>>

const DEFAULT_FILTER_LABELS: Record<ShopFilterId, string> = {
  all: "Alle",
  "3d": "3D-Druck",
  laser: "Laser-Gravur",
  sale: "Rabatt",
}

export function isProductOnSale(product: Product): boolean {
  if (product.sale) return true
  if (product.originalPrice != null && product.originalPrice > product.price) return true
  return getSaleBadgePercent(product) != null
}

export function buildShopFilterOptions(
  products: Product[],
  services: ServiceVisibilitySettings,
  labels: ShopFilterLabels = {}
): ShopFilterOption[] {
  const label = (id: ShopFilterId) => labels[id]?.trim() || DEFAULT_FILTER_LABELS[id]

  const activeProducts = products.filter((p) => p.istAktiv !== false)
  const has3dProducts = activeProducts.some((p) => p.type === "3d")
  const hasLaserProducts = activeProducts.some((p) => p.type === "laser")
  const hasSaleProducts = activeProducts.some(isProductOnSale)

  const filters: ShopFilterOption[] = [{ id: "all", label: label("all") }]

  if (services.druck3d && has3dProducts) {
    filters.push({ id: "3d", label: label("3d") })
  }
  if (services.lasergravur && hasLaserProducts) {
    filters.push({ id: "laser", label: label("laser") })
  }
  if (hasSaleProducts) {
    filters.push({ id: "sale", label: label("sale") })
  }

  return filters
}

export function isShopFilterId(value: string, options: ShopFilterOption[]): value is ShopFilterId {
  return options.some((option) => option.id === value)
}

export function filterProductsByShopFilter(
  products: Product[],
  filterId: ShopFilterId
): Product[] {
  const active = products.filter((p) => p.istAktiv !== false)

  switch (filterId) {
    case "3d":
      return active.filter((p) => p.type === "3d")
    case "laser":
      return active.filter((p) => p.type === "laser")
    case "sale":
      return active.filter(isProductOnSale)
    default:
      return active
  }
}
