import { getMaterialById, upsertMaterial } from "@/lib/admin/material-db"
import {
  getEffectiveMaterialStock,
  type MaterialItem,
  type OrderMaterialReservation,
  type ProductMaterialLink,
} from "@/lib/admin/material-types"
import { getAdminProductById } from "@/lib/admin/db"
import type { StoredOrder, StoredOrderItem } from "@/lib/admin/types"

function matchProductVariant(
  item: StoredOrderItem,
  link: ProductMaterialLink
): boolean {
  if (!link.productVariant?.trim()) return true
  const wanted = link.productVariant.trim().toLowerCase()
  const fromItem =
    item.customDetails?.variant ??
    item.customDetails?.materialVariant ??
    item.customDetails?.color ??
    ""
  if (String(fromItem).trim().toLowerCase() === wanted) return true
  return item.name.toLowerCase().includes(wanted)
}

function resolveLinksForItem(
  item: StoredOrderItem,
  links: ProductMaterialLink[]
): ProductMaterialLink[] {
  const specific = links.filter((l) => l.productVariant?.trim())
  const generic = links.filter((l) => !l.productVariant?.trim())
  const matchedSpecific = specific.filter((l) => matchProductVariant(item, l))
  if (matchedSpecific.length > 0) return matchedSpecific
  return generic
}

export async function computeOrderMaterialReservations(
  order: StoredOrder
): Promise<OrderMaterialReservation[]> {
  const reservations: OrderMaterialReservation[] = []

  for (const item of order.items) {
    const product = await getAdminProductById(item.id)
    const links = product?.materialLinks ?? []
    if (links.length === 0) continue

    const applicable = resolveLinksForItem(item, links)
    for (const link of applicable) {
      const material = await getMaterialById(link.materialId)
      if (!material) continue
      const qty = Math.max(1, item.quantity)
      const amount =
        material.stockUnit === "gram"
          ? Math.max(0, Math.round(link.consumptionGrams * qty))
          : qty

      if (amount <= 0) continue

      reservations.push({
        materialId: link.materialId,
        quantity: amount,
        stockUnit: material.stockUnit,
      })
    }
  }

  return reservations
}

type StockMutation = "reserve" | "consume" | "release"

function mutateMaterialStock(
  material: MaterialItem,
  amount: number,
  mode: StockMutation
): MaterialItem | null {
  if (amount <= 0) return material

  if (mode === "reserve") {
    if (material.stockAvailable < amount) return null
    return {
      ...material,
      stockAvailable: material.stockAvailable - amount,
      stockReserved: material.stockReserved + amount,
    }
  }
  if (mode === "consume") {
    if (material.stockReserved < amount) return null
    return { ...material, stockReserved: material.stockReserved - amount }
  }
  if (material.stockReserved < amount) return null
  return {
    ...material,
    stockAvailable: material.stockAvailable + amount,
    stockReserved: material.stockReserved - amount,
  }
}

async function applyReservations(
  reservations: OrderMaterialReservation[],
  mode: StockMutation
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = []

  for (const reservation of reservations) {
    const material = await getMaterialById(reservation.materialId)
    if (!material) {
      errors.push(`Material ${reservation.materialId} nicht gefunden.`)
      continue
    }

    const updated = mutateMaterialStock(material, reservation.quantity, mode)

    if (!updated) {
      const stock = getEffectiveMaterialStock(material)
      errors.push(
        `Nicht genug Bestand für «${material.name}» (${reservation.quantity}${material.stockUnit === "gram" ? "g" : " Stk."}, verfügbar: ${stock.stockAvailable}).`
      )
      continue
    }

    await upsertMaterial(updated)
  }

  return { ok: errors.length === 0, errors }
}

export async function reserveMaterialsForOrder(order: StoredOrder): Promise<{
  reserved: boolean
  reservations: OrderMaterialReservation[]
  errors: string[]
}> {
  if (order.inventoryState === "reserved" || order.inventoryState === "consumed") {
    return { reserved: false, reservations: order.materialReservations ?? [], errors: [] }
  }

  const reservations = await computeOrderMaterialReservations(order)
  if (reservations.length === 0) {
    return { reserved: true, reservations: [], errors: [] }
  }

  const result = await applyReservations(reservations, "reserve")
  return {
    reserved: result.ok,
    reservations,
    errors: result.errors,
  }
}

export async function consumeReservedMaterialsForOrder(
  order: StoredOrder
): Promise<{ ok: boolean; errors: string[] }> {
  const reservations = order.materialReservations ?? []
  if (reservations.length === 0) return { ok: true, errors: [] }
  if (order.inventoryState === "consumed") return { ok: true, errors: [] }

  return applyReservations(reservations, "consume")
}

export async function releaseReservedMaterialsForOrder(
  order: StoredOrder
): Promise<{ ok: boolean; errors: string[] }> {
  const reservations = order.materialReservations ?? []
  if (reservations.length === 0) return { ok: true, errors: [] }
  if (order.inventoryState === "released" || order.inventoryState === "consumed") {
    return { ok: true, errors: [] }
  }

  return applyReservations(reservations, "release")
}
