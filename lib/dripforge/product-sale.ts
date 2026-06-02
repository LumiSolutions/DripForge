import type { Product } from "@/lib/dripforge/types"

export type SaleRabattTyp = "percent" | "fixed"

export function roundChf(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function calculateSalePrice(
  basisPreis: number,
  typ: SaleRabattTyp,
  wert: number
): number {
  if (basisPreis <= 0) return 0

  let endpreis: number
  if (typ === "percent") {
    endpreis = basisPreis * (1 - wert / 100)
  } else {
    endpreis = basisPreis - wert
  }

  return roundChf(Math.max(0, endpreis))
}

export function validateSaleDiscount(
  basisPreis: number,
  typ: SaleRabattTyp,
  wert: number
): string | null {
  if (basisPreis <= 0) {
    return "Bitte einen gueltigen Basispreis eingeben."
  }
  if (wert <= 0) {
    return "Der Rabatt-Wert muss groesser als 0 sein."
  }
  if (typ === "percent") {
    if (wert >= 100) {
      return "Prozent-Rabatt muss unter 100% liegen."
    }
  } else if (wert >= basisPreis) {
    return "Der Festbetrag darf den Basispreis nicht erreichen oder ueberschreiten."
  }

  const endpreis = calculateSalePrice(basisPreis, typ, wert)
  if (endpreis <= 0) {
    return "Der berechnete Endpreis muss groesser als CHF 0.00 sein."
  }

  return null
}

export function inferSaleRabattFromProduct(product: Product): {
  typ: SaleRabattTyp
  wert: number
} {
  if (
    product.saleRabattTyp &&
    product.saleRabattWert != null &&
    product.saleRabattWert > 0
  ) {
    return {
      typ: product.saleRabattTyp,
      wert: product.saleRabattWert,
    }
  }

  const basis =
    product.basisPreis ?? product.originalPrice ?? product.price
  const endpreis = product.price

  if (product.sale && product.originalPrice && product.originalPrice > endpreis) {
    const fixedDiff = roundChf(product.originalPrice - endpreis)
    const percent = roundChf((fixedDiff / product.originalPrice) * 100)
    const percentEnd = calculateSalePrice(product.originalPrice, "percent", percent)
    if (Math.abs(percentEnd - endpreis) < 0.02) {
      return { typ: "percent", wert: percent }
    }
    return { typ: "fixed", wert: fixedDiff }
  }

  return { typ: "percent", wert: 10 }
}

export function resolveProductBasisPreis(product: Product): number {
  return product.basisPreis ?? product.originalPrice ?? product.price
}

export function getSaleBadgePercent(product: Product): number | null {
  if (!product.sale || !product.originalPrice || product.originalPrice <= 0) {
    return null
  }
  return Math.round(
    ((product.originalPrice - product.price) / product.originalPrice) * 100
  )
}

export function applySaleToProductFields(input: {
  basisPreis: number
  sale: boolean
  saleRabattTyp?: SaleRabattTyp
  saleRabattWert?: number
}): Pick<
  Product,
  "basisPreis" | "price" | "originalPrice" | "sale" | "saleRabattTyp" | "saleRabattWert"
> {
  const basisPreis = roundChf(Math.max(0, input.basisPreis))

  if (!input.sale) {
    return {
      basisPreis,
      price: basisPreis,
      originalPrice: null,
      sale: false,
      saleRabattTyp: undefined,
      saleRabattWert: undefined,
    }
  }

  const typ = input.saleRabattTyp ?? "percent"
  const wert = Number(input.saleRabattWert) || 0
  const price = calculateSalePrice(basisPreis, typ, wert)

  return {
    basisPreis,
    price,
    originalPrice: basisPreis,
    sale: true,
    saleRabattTyp: typ,
    saleRabattWert: wert,
  }
}
