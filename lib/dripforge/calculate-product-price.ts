/**
 * Einheitliche Shop-/PDP-Preisberechnung mit Stapelung:
 * Sale/Aktionspreis → optional Mengenrabatt → Kundenkategorie „on top“.
 *
 * Beispiel: UVP 20 → Sale 10% = 18 → Kategorie −50% = 9.
 */

import { applyCategoryDiscount } from "@/lib/dripforge/customer-categories"
import {
  applyQuantityDiscountToUnitPrice,
  normalizeQuantityDiscountTiers,
  type QuantityDiscountTier,
} from "@/lib/dripforge/quantity-discount-tiers"

export type CalculateProductPriceInput = {
  /** Aktueller Shop-Preis (bereits inkl. Sale, falls aktiv). */
  price: number
  /** UVP / Strichpreis vor Produktrabatt. */
  originalPrice?: number | null
  sale?: boolean
  quantityDiscountTiers?: QuantityDiscountTier[] | null
  /** Stückzahl für Staffelrabatt (PDP: nur aktuelle Auswahl). */
  quantity?: number
  /** Kundenkategorie-Rabatt in Prozent (0–100). */
  categoryDiscountPercent?: number
}

export type CalculateProductPriceResult = {
  /** UVP / Listenpreis vor Produktrabatt. */
  listPrice: number
  /** Preis nach Produktrabatt (Sale), vor Mengen-/Kategorie-Rabatt. */
  saleUnitPrice: number
  /** Preis nach Mengenrabatt, vor Kategorie. */
  preCategoryUnitPrice: number
  /** Endpreis nach Kategorie-Rabatt. */
  unitPrice: number
  /** Durchgestrichen anzuzeigender Referenzpreis (bevorzugt UVP). */
  strikePrice: number | null
  quantityDiscountPercent: number
  categoryDiscountPercent: number
  onSale: boolean
}

/**
 * Berechnet den gestapelten Endpreis und den Strike-Referenzpreis.
 */
export function calculateProductPrice(
  input: CalculateProductPriceInput
): CalculateProductPriceResult {
  const saleUnitPrice = Math.max(0, Number(input.price) || 0)
  const rawOriginal =
    input.originalPrice != null && Number.isFinite(Number(input.originalPrice))
      ? Number(input.originalPrice)
      : null
  const onSale =
    Boolean(input.sale) && rawOriginal != null && rawOriginal > saleUnitPrice + 0.001
  const listPrice = onSale ? rawOriginal! : saleUnitPrice

  const tiers = normalizeQuantityDiscountTiers(input.quantityDiscountTiers)
  const qty = Math.max(1, Math.floor(Number(input.quantity) || 1))
  const qtyResult = applyQuantityDiscountToUnitPrice(saleUnitPrice, tiers, qty)
  const preCategoryUnitPrice = qtyResult.unitPrice

  const categoryDiscountPercent = Math.max(
    0,
    Math.min(100, Number(input.categoryDiscountPercent) || 0)
  )
  const unitPrice =
    categoryDiscountPercent > 0
      ? applyCategoryDiscount(preCategoryUnitPrice, categoryDiscountPercent)
      : preCategoryUnitPrice

  // Transparenz: UVP (falls Sale) hat Vorrang als Strike, sonst Preis vor Kategorie.
  let strikePrice: number | null = null
  if (unitPrice + 0.001 < listPrice) {
    strikePrice = listPrice
  } else if (unitPrice + 0.001 < preCategoryUnitPrice) {
    strikePrice = preCategoryUnitPrice
  } else if (unitPrice + 0.001 < saleUnitPrice) {
    strikePrice = saleUnitPrice
  }

  return {
    listPrice,
    saleUnitPrice,
    preCategoryUnitPrice,
    unitPrice,
    strikePrice,
    quantityDiscountPercent: qtyResult.discountPercent,
    categoryDiscountPercent,
    onSale,
  }
}
