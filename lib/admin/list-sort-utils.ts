import {
  getEffectiveMaterialStock,
  isMaterialLowStock,
  type MaterialItem,
} from "@/lib/admin/material-types"
import { findMaterialType, normalizeMaterialTypeKey, type MaterialTypeDefinition } from "@/lib/admin/material-stats-types"
import type { ProductTag } from "@/lib/admin/product-tags"
import { getProductShopStatus, isProductActive, type ProductShopStatus } from "@/lib/admin/product-status"
import type { AdminProduct } from "@/lib/admin/types"

export type ProductSortMode = "name-asc" | "price-asc" | "price-desc" | "created-desc" | "created-asc"

export type SortDirection = "asc" | "desc"

export type ProductColumnSort = {
  column: "name" | "type" | "price" | "status" | "created"
  direction: SortDirection
}

export type TagColumnSort = {
  column: "name" | "group"
  direction: SortDirection
}

export type StockSortMode =
  | "material-type"
  | "manufacturer"
  | "color-asc"
  | "name-asc"
  | "stock-asc"

const STATUS_ORDER: Record<ProductShopStatus, number> = {
  active: 0,
  sale: 1,
  inactive: 2,
}

function productCreatedAt(product: AdminProduct): number {
  if (product.createdAt) return new Date(product.createdAt).getTime()
  const match = product.id?.match(/p-(\d+)/)
  if (match) return Number(match[1])
  if (product.updatedAt) return new Date(product.updatedAt).getTime()
  return 0
}

/** Active (incl. sale) before inactive (`istAktiv === false`). */
function compareActiveFirst(a: AdminProduct, b: AdminProduct): number {
  const aInactive = isProductActive(a) ? 0 : 1
  const bInactive = isProductActive(b) ? 0 : 1
  return aInactive - bInactive
}

function compareByMode(a: AdminProduct, b: AdminProduct, mode: ProductSortMode): number {
  switch (mode) {
    case "name-asc":
      return a.name.localeCompare(b.name, "de")
    case "price-asc":
      return a.price - b.price
    case "price-desc":
      return b.price - a.price
    case "created-asc":
      return productCreatedAt(a) - productCreatedAt(b)
    case "created-desc":
    default:
      return productCreatedAt(b) - productCreatedAt(a)
  }
}

export function sortProducts(items: AdminProduct[], mode: ProductSortMode): AdminProduct[] {
  const copy = [...items]
  switch (mode) {
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "de"))
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price)
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price)
    case "created-asc":
      return copy.sort((a, b) => productCreatedAt(a) - productCreatedAt(b))
    case "created-desc":
    default:
      return copy.sort((a, b) => productCreatedAt(b) - productCreatedAt(a))
  }
}

/**
 * Inactive products always sort after active/sale products; within each group
 * the secondary `mode` is applied.
 */
export function sortProductsWithActiveFirst(
  items: AdminProduct[],
  mode: ProductSortMode
): AdminProduct[] {
  return [...items].sort((a, b) => {
    const activeCmp = compareActiveFirst(a, b)
    if (activeCmp !== 0) return activeCmp
    return compareByMode(a, b, mode)
  })
}

export function toggleSortDirection(direction: SortDirection): SortDirection {
  return direction === "asc" ? "desc" : "asc"
}

/** Default direction when switching to a new product column. */
export function defaultProductColumnDirection(
  column: ProductColumnSort["column"]
): SortDirection {
  if (column === "price" || column === "created") return "desc"
  return "asc"
}

/** Default direction when switching to a new tag column. */
export function defaultTagColumnDirection(
  column: TagColumnSort["column"]
): SortDirection {
  return "asc"
}

function compareByColumn(
  a: AdminProduct,
  b: AdminProduct,
  columnSort: ProductColumnSort
): number {
  const dir = columnSort.direction === "asc" ? 1 : -1
  switch (columnSort.column) {
    case "name":
      return a.name.localeCompare(b.name, "de") * dir
    case "type":
      return a.type.localeCompare(b.type, "de") * dir
    case "price":
      return (a.price - b.price) * dir
    case "status": {
      const statusA = STATUS_ORDER[getProductShopStatus(a)]
      const statusB = STATUS_ORDER[getProductShopStatus(b)]
      return (statusA - statusB) * dir
    }
    case "created":
      return (productCreatedAt(a) - productCreatedAt(b)) * dir
    default:
      return 0
  }
}

/**
 * Groups active (incl. sale) before inactive, then sorts by column.
 * For status: active < sale < inactive (reversed when desc).
 */
export function sortProductsByColumn(
  items: AdminProduct[],
  columnSort: ProductColumnSort
): AdminProduct[] {
  return [...items].sort((a, b) => {
    // Status column already encodes active/sale/inactive ordering.
    if (columnSort.column !== "status") {
      const activeCmp = compareActiveFirst(a, b)
      if (activeCmp !== 0) return activeCmp
    }
    const cmp = compareByColumn(a, b, columnSort)
    if (cmp !== 0) return cmp
    return a.name.localeCompare(b.name, "de")
  })
}

/** Default tag list order: group → sortOrder → name. */
export function sortTagsDefault(tags: ProductTag[]): ProductTag[] {
  return [...tags].sort((a, b) => {
    const groupCmp = (a.group || "Allgemein").localeCompare(b.group || "Allgemein", "de")
    if (groupCmp !== 0) return groupCmp
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")
  })
}

export function sortTagsByColumn(
  tags: ProductTag[],
  columnSort: TagColumnSort | null
): ProductTag[] {
  if (!columnSort) return sortTagsDefault(tags)
  const dir = columnSort.direction === "asc" ? 1 : -1
  return [...tags].sort((a, b) => {
    if (columnSort.column === "name") {
      const cmp = a.name.localeCompare(b.name, "de") * dir
      if (cmp !== 0) return cmp
      return (a.group || "Allgemein").localeCompare(b.group || "Allgemein", "de")
    }
    const groupCmp =
      (a.group || "Allgemein").localeCompare(b.group || "Allgemein", "de") * dir
    if (groupCmp !== 0) return groupCmp
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")
  })
}

function materialTypeSortKey(
  item: MaterialItem,
  typeOrder: Map<string, number>
): string {
  const ref = item.materialType ?? ""
  const order = typeOrder.get(normalizeMaterialTypeKey(ref))
  const prefix = order != null ? String(order).padStart(4, "0") : "9999"
  return `${prefix}-${ref}`
}

export function sortStockItems(
  items: MaterialItem[],
  mode: StockSortMode,
  materialTypes: MaterialTypeDefinition[] = []
): MaterialItem[] {
  const copy = [...items]
  const typeOrder = new Map(
    materialTypes.map((type, index) => [type.id, type.sortOrder ?? index])
  )

  switch (mode) {
    case "material-type":
      return copy.sort((a, b) => {
        const keyA = materialTypeSortKey(a, typeOrder)
        const keyB = materialTypeSortKey(b, typeOrder)
        if (keyA !== keyB) return keyA.localeCompare(keyB)
        return (a.manufacturer ?? "").localeCompare(b.manufacturer ?? "", "de")
      })
    case "manufacturer":
      return copy.sort((a, b) => {
        const m = (a.manufacturer ?? "").localeCompare(b.manufacturer ?? "", "de")
        if (m !== 0) return m
        return (a.name ?? "").localeCompare(b.name ?? "", "de")
      })
    case "color-asc":
      return copy.sort((a, b) => {
        const c = (a.farbe ?? a.typ ?? "").localeCompare(b.farbe ?? b.typ ?? "", "de")
        if (c !== 0) return c
        return (a.name ?? "").localeCompare(b.name ?? "", "de")
      })
    case "name-asc":
      return copy.sort((a, b) => {
        const n = (a.name ?? "").localeCompare(b.name ?? "", "de")
        if (n !== 0) return n
        return (a.typ ?? "").localeCompare(b.typ ?? "", "de")
      })
    case "stock-asc":
    default:
      return copy.sort((a, b) => {
        const aCritical = isMaterialLowStock(a) ? 0 : 1
        const bCritical = isMaterialLowStock(b) ? 0 : 1
        if (aCritical !== bCritical) return aCritical - bCritical
        const stockA = getEffectiveMaterialStock(a).stockAvailable
        const stockB = getEffectiveMaterialStock(b).stockAvailable
        if (stockA !== stockB) return stockA - stockB
        return (a.name ?? "").localeCompare(b.name ?? "", "de")
      })
  }
}

export function countStockForMaterialType(
  items: MaterialItem[],
  type: MaterialTypeDefinition
): number {
  return items.filter((item) => {
    if (!item.materialType) return false
    const found = findMaterialType([type], item.materialType)
    return found?.id === type.id
  }).length
}
