import {
  getEffectiveMaterialStock,
  isMaterialLowStock,
  type MaterialItem,
} from "@/lib/admin/material-types"
import { findMaterialType, normalizeMaterialTypeKey, type MaterialTypeDefinition } from "@/lib/admin/material-stats-types"
import type { AdminProduct } from "@/lib/admin/types"

export type ProductSortMode = "name-asc" | "price-asc" | "price-desc" | "created-desc" | "created-asc"

export type StockSortMode =
  | "material-type"
  | "manufacturer"
  | "color-asc"
  | "stock-asc"

function productCreatedAt(product: AdminProduct): number {
  if (product.createdAt) return new Date(product.createdAt).getTime()
  const match = product.id?.match(/p-(\d+)/)
  if (match) return Number(match[1])
  if (product.updatedAt) return new Date(product.updatedAt).getTime()
  return 0
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
        const c = (a.farbe ?? "").localeCompare(b.farbe ?? "", "de")
        if (c !== 0) return c
        return (a.name ?? "").localeCompare(b.name ?? "", "de")
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
