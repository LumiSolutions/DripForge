import { getProductById, patchProductFields } from "@/lib/admin/db"
import { normalizeStockQuantity } from "@/lib/dripforge/product-inventory"
import type { StoredOrder, StoredOrderItem } from "@/lib/admin/types"

function resolveOrderItemProductId(item: StoredOrderItem): string | null {
  const fromField = item.productId?.trim()
  if (fromField) return fromField
  const raw = item.id?.trim()
  if (!raw) return null
  // Warenkorbzeilen: `${productId}-${timestamp}` — Fallback wenn productId fehlt
  const match = raw.match(/^(.*)-\d{10,}$/)
  return match?.[1]?.trim() || raw
}

function aggregateTrackedQuantities(
  items: StoredOrderItem[]
): Map<string, number> {
  const byProduct = new Map<string, number>()
  for (const item of items) {
    const productId = resolveOrderItemProductId(item)
    if (!productId) continue
    const qty = Math.max(0, Math.round(Number(item.quantity) || 0))
    if (qty <= 0) continue
    byProduct.set(productId, (byProduct.get(productId) ?? 0) + qty)
  }
  return byProduct
}

/**
 * Verringert trackInventory-Bestände bei neuer Bestellung.
 * Produkte ohne trackInventory bleiben unverändert.
 */
export async function debitTrackedProductStockForOrder(
  order: StoredOrder
): Promise<{ ok: boolean; errors: string[] }> {
  if (order.productStockDebited) {
    return { ok: true, errors: [] }
  }

  const errors: string[] = []
  const quantities = aggregateTrackedQuantities(order.items)

  for (const [productId, qty] of quantities) {
    try {
      const product = await getProductById(productId)
      if (!product?.trackInventory) continue
      const current = normalizeStockQuantity(product.stockQuantity ?? 0)
      const nextQty = Math.max(0, current - qty)
      const saved = await patchProductFields(productId, {
        stockQuantity: nextQty,
      })
      if (!saved) {
        errors.push(`Produkt ${productId} nicht gefunden`)
      }
    } catch (error) {
      errors.push(
        `Bestand ${productId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  return { ok: errors.length === 0, errors }
}

/** Stellt trackInventory-Bestände bei Storno wieder her. */
export async function restoreTrackedProductStockForOrder(
  order: StoredOrder
): Promise<{ ok: boolean; errors: string[] }> {
  if (!order.productStockDebited) {
    return { ok: true, errors: [] }
  }

  const errors: string[] = []
  const quantities = aggregateTrackedQuantities(order.items)

  for (const [productId, qty] of quantities) {
    try {
      const product = await getProductById(productId)
      if (!product?.trackInventory) continue
      const current = normalizeStockQuantity(product.stockQuantity ?? 0)
      const nextQty = normalizeStockQuantity(current + qty)
      const saved = await patchProductFields(productId, {
        stockQuantity: nextQty,
      })
      if (!saved) {
        errors.push(`Produkt ${productId} nicht gefunden`)
      }
    } catch (error) {
      errors.push(
        `Bestand-Restore ${productId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  return { ok: errors.length === 0, errors }
}
