import {
  GRAMS_PER_FULL_SPOOL,
  type MaterialItem,
  type ProductMaterialLink,
} from "@/lib/admin/material-types"
import { roundChf } from "@/lib/dripforge/product-sale"

export type MaterialLinkCostLine = {
  link: ProductMaterialLink
  material?: MaterialItem
  costChf: number
  label: string
  detail: string
}

export type ProductPricingBreakdown = {
  lines: MaterialLinkCostLine[]
  materialCostChf: number
  additionalBaseCostChf: number
  totalSelfCostChf: number
}

export function materialPurchasePriceUnitLabel(material: MaterialItem): string {
  if (material.stockUnit === "gram") {
    return `pro ${GRAMS_PER_FULL_SPOOL}g Rolle`
  }
  return "pro Stück"
}

export function calculateMaterialLinkCostChf(
  link: ProductMaterialLink,
  material?: MaterialItem
): number {
  if (!material) return 0
  const purchasePrice = Math.max(0, Number(material.purchasePrice) || 0)
  if (purchasePrice <= 0) return 0

  const consumption = Math.max(0, Number(link.consumptionGrams) || 0)
  if (consumption <= 0) return 0

  if (material.stockUnit === "gram") {
    return roundChf((consumption / GRAMS_PER_FULL_SPOOL) * purchasePrice)
  }

  return roundChf(consumption * purchasePrice)
}

function formatMaterialLinkDetail(
  link: ProductMaterialLink,
  material: MaterialItem,
  costChf: number
): string {
  const purchasePrice = Math.max(0, Number(material.purchasePrice) || 0)
  const consumption = Math.max(0, Number(link.consumptionGrams) || 0)

  if (material.stockUnit === "gram") {
    return `${consumption}g × (CHF ${purchasePrice.toFixed(2)} / ${GRAMS_PER_FULL_SPOOL}g) = CHF ${costChf.toFixed(2)}`
  }

  return `${consumption} St × CHF ${purchasePrice.toFixed(2)} = CHF ${costChf.toFixed(2)}`
}

export function calculateProductPricingBreakdown(
  links: ProductMaterialLink[],
  catalog: MaterialItem[],
  additionalBaseCostChf = 0
): ProductPricingBreakdown {
  const lines: MaterialLinkCostLine[] = links
    .filter((link) => link.materialId)
    .map((link) => {
      const material = catalog.find((item) => item.id === link.materialId)
      const costChf = calculateMaterialLinkCostChf(link, material)
      const label = material
        ? [material.manufacturer, material.name, material.farbe].filter(Boolean).join(" — ") ||
          material.name
        : link.materialId

      return {
        link,
        material,
        costChf,
        label,
        detail: material
          ? formatMaterialLinkDetail(link, material, costChf)
          : "Material nicht im Lager gefunden",
      }
    })

  const materialCostChf = roundChf(lines.reduce((sum, line) => sum + line.costChf, 0))
  const additional = roundChf(Math.max(0, Number(additionalBaseCostChf) || 0))
  const totalSelfCostChf = roundChf(materialCostChf + additional)

  return {
    lines,
    materialCostChf,
    additionalBaseCostChf: additional,
    totalSelfCostChf,
  }
}

export function salePriceFromMarkupFactor(totalSelfCostChf: number, factor: number): number {
  if (totalSelfCostChf <= 0 || factor <= 0) return 0
  return roundChf(totalSelfCostChf * factor)
}

/** Bruttomarge auf Verkaufspreis: (VK − EK) / VK */
export function salePriceFromTargetMarginPercent(
  totalSelfCostChf: number,
  marginPercent: number
): number {
  if (totalSelfCostChf <= 0) return 0
  if (marginPercent >= 100) return 0
  const divisor = 1 - marginPercent / 100
  if (divisor <= 0) return 0
  return roundChf(totalSelfCostChf / divisor)
}

export function calculateGrossMarginPercent(salePriceChf: number, selfCostChf: number): number | null {
  if (salePriceChf <= 0) return null
  return roundChf(((salePriceChf - selfCostChf) / salePriceChf) * 100)
}

export function calculateMarkupFactor(salePriceChf: number, selfCostChf: number): number | null {
  if (selfCostChf <= 0) return null
  return roundChf(salePriceChf / selfCostChf)
}
