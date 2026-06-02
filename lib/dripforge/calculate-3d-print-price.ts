import {
  DEFAULT_PRICING_CONFIG,
  type PricingConfig,
} from "@/lib/dripforge/pricing-config"

export type PrintPriceBreakdown = {
  volumeCm3: number
  calculatedWeightG: number
  materialCost: number
  setupFee: number
  multiColorSurcharge: number
  colorCount: number
  unitPrice: number
  totalPrice: number
}

export function calculate3DPrintPrice(
  volumeCm3: number,
  quantity: number,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
  colorCount = 1
): PrintPriceBreakdown {
  const calculatedWeightG = volumeCm3 * config.densityPLA
  const materialCost = calculatedWeightG * config.pricePerGramPLA
  const baseUnitPrice = materialCost + config.setupFee

  const extraColors = Math.max(0, colorCount - 1)
  const surchargeMultiplier =
    1 + (extraColors * config.multiColorSurchargePercentPerExtra) / 100
  const multiColorSurcharge = baseUnitPrice * (surchargeMultiplier - 1)
  const unitPrice = baseUnitPrice + multiColorSurcharge
  const totalPrice = unitPrice * Math.max(1, quantity)

  return {
    volumeCm3,
    calculatedWeightG,
    materialCost,
    setupFee: config.setupFee,
    multiColorSurcharge,
    colorCount: Math.max(1, colorCount),
    unitPrice,
    totalPrice,
  }
}
