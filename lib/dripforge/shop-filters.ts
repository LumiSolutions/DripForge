import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import type { Product } from "@/lib/dripforge/types"
import { getSaleBadgePercent } from "@/lib/dripforge/product-sale"
import { isProductActive } from "@/lib/admin/product-status"

export type ShopFilterId = "all" | "3d" | "laser" | "sale" | "limited"

export type ShopFilterOption = {
  id: ShopFilterId
  label: string
}

export type ShopFilterLabels = Partial<Record<ShopFilterId, string>>

const DEFAULT_FILTER_LABELS: Record<ShopFilterId, string> = {
  all: "Alle",
  "3d": "3D-Druck",
  laser: "Laser-Gravur",
  sale: "Sale %",
  limited: "Limited Edition",
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

  const activeProducts = (products ?? []).filter((p) => isProductActive(p))
  const has3dProducts = activeProducts.some((p) => p.type === "3d")
  const hasLaserProducts = activeProducts.some((p) => p.type === "laser")
  const hasSaleProducts = activeProducts.some(isProductOnSale)
  const hasLimitedProducts = activeProducts.some((p) => p.limitedEdition)

  const filters: ShopFilterOption[] = [{ id: "all", label: label("all") }]

  if (services?.druck3d && has3dProducts) {
    filters.push({ id: "3d", label: label("3d") })
  }
  if (services?.lasergravur && hasLaserProducts) {
    filters.push({ id: "laser", label: label("laser") })
  }
  if (hasSaleProducts) {
    filters.push({ id: "sale", label: label("sale") })
  }
  if (hasLimitedProducts) {
    filters.push({ id: "limited", label: label("limited") })
  }

  return filters
}

export function isShopFilterId(value: string, options: ShopFilterOption[]): value is ShopFilterId {
  return (options ?? []).some((option) => option.id === value)
}

export type ShopFilterOptions = {
  /** When set with filter `limited`, only products for this seasonal event are shown. */
  seasonalEventId?: string | null
}

export function filterProductsByShopFilter(
  products: Product[],
  filterId: ShopFilterId,
  options: ShopFilterOptions = {}
): Product[] {
  const active = products.filter((p) => isProductActive(p))

  switch (filterId) {
    case "3d":
      return active.filter((p) => p.type === "3d")
    case "laser":
      return active.filter((p) => p.type === "laser")
    case "sale":
      return active.filter(isProductOnSale)
    case "limited": {
      const limited = active.filter((p) => p.limitedEdition)
      const eventId = options.seasonalEventId?.trim()
      if (!eventId) return limited
      return limited.filter((p) => p.seasonalEventId === eventId)
    }
    default:
      return active
  }
}
