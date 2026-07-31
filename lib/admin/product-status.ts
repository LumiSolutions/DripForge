import type { Product } from "@/lib/dripforge/types"

/**
 * Shop-/Admin-Produktstatus (abgeleitet aus `istAktiv` + `sale`).
 * Persistiert wird weiterhin `istAktiv` / `sale` in Cosmos.
 */
export type ProductShopStatus = "active" | "sale" | "inactive"

export const PRODUCT_SHOP_STATUS_OPTIONS: Array<{
  value: ProductShopStatus
  label: string
}> = [
  { value: "active", label: "Aktiv" },
  { value: "sale", label: "Sale" },
  { value: "inactive", label: "Inaktiv / Archiviert" },
]

/** Sichtbar im Shop wenn nicht explizit inaktiv/archiviert. */
export function isProductActive(product: Pick<Product, "istAktiv">): boolean {
  return product.istAktiv !== false
}

export function getProductShopStatus(
  product: Pick<Product, "istAktiv" | "sale">
): ProductShopStatus {
  if (!isProductActive(product)) return "inactive"
  if (product.sale) return "sale"
  return "active"
}

export function productShopStatusLabel(status: ProductShopStatus): string {
  switch (status) {
    case "sale":
      return "Sale"
    case "inactive":
      return "Inaktiv"
    default:
      return "Aktiv"
  }
}

/**
 * Mappt einen Status auf Patch-Felder für Cosmos.
 * Bei «inactive» bleibt `sale` erhalten (Rabatt-Konfig bleibt für Reaktivierung).
 */
export function productFieldsFromShopStatus(
  status: ProductShopStatus
): { istAktiv: boolean; sale?: boolean } {
  switch (status) {
    case "sale":
      return { istAktiv: true, sale: true }
    case "inactive":
      return { istAktiv: false }
    default:
      return { istAktiv: true, sale: false }
  }
}

export function isProductShopStatus(value: unknown): value is ProductShopStatus {
  return value === "active" || value === "sale" || value === "inactive"
}

/** Öffentlicher Shop: nur Status `active` oder `sale`. */
export function isProductVisibleInShop(
  product: Pick<Product, "istAktiv" | "sale">
): boolean {
  const status = getProductShopStatus(product)
  return status === "active" || status === "sale"
}
