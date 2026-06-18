import type { PrintCalculatorSettings } from "@/lib/admin/print-calculator-types"
import {
  buildAutoQuoteInput,
  calculatePrintCostBreakdown,
  resolveMaterial,
  weightFromVolumeCm3,
} from "@/lib/dripforge/print-calculator-engine"
import {
  DEFAULT_PRICING_CONFIG,
  type PricingConfig,
} from "@/lib/dripforge/pricing-config"

export type PrintPriceBreakdown = {
  volumeCm3: number
  calculatedWeightG: number
  materialCost: number
  setupFee: number
  electricityCost: number
  depreciationCost: number
  laborCost: number
  errorRateCost: number
  markupCost: number
  multiColorSurcharge: number
  colorCount: number
  unitPrice: number
  totalPrice: number
  /** Vollstaendige Selbstkosten vor Aufschlag (intern) */
  subtotalWithErrorChf: number
}

function roundChf(value: number): number {
  return Math.round(value * 100) / 100
}

/** Legacy-Fallback ohne Cosmos-Einstellungen. */
export function calculate3DPrintPriceLegacy(
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
    materialCost: roundChf(materialCost),
    setupFee: config.setupFee,
    electricityCost: 0,
    depreciationCost: 0,
    laborCost: 0,
    errorRateCost: 0,
    markupCost: 0,
    multiColorSurcharge: roundChf(multiColorSurcharge),
    colorCount: Math.max(1, colorCount),
    unitPrice: roundChf(unitPrice),
    totalPrice: roundChf(totalPrice),
    subtotalWithErrorChf: roundChf(baseUnitPrice),
  }
}

/** Kunden-Offerte auf Basis der Admin Druck-Kalkulator-Einstellungen. */
export function calculate3DPrintPriceFromSettings(
  volumeCm3: number,
  quantity: number,
  settings: PrintCalculatorSettings,
  colorCount = 1,
  materialId?: string
): PrintPriceBreakdown {
  const material = resolveMaterial(settings, materialId ?? settings.global.defaultMaterialId)
  const calculatedWeightG = weightFromVolumeCm3(volumeCm3, material.densityGPerCm3)
  const input = buildAutoQuoteInput(settings, calculatedWeightG, {
    materialId: material.id,
  })
  const cost = calculatePrintCostBreakdown(settings, input)

  const baseUnitPrice = cost.endPriceChf + settings.global.setupFeeChf
  const extraColors = Math.max(0, colorCount - 1)
  const surchargeMultiplier =
    1 +
    (extraColors * settings.global.multiColorSurchargePercentPerExtra) / 100
  const multiColorSurcharge = baseUnitPrice * (surchargeMultiplier - 1)
  const unitPrice = baseUnitPrice + multiColorSurcharge
  const totalPrice = unitPrice * Math.max(1, quantity)

  return {
    volumeCm3,
    calculatedWeightG: roundChf(calculatedWeightG),
    materialCost: cost.filamentCostChf,
    setupFee: settings.global.setupFeeChf,
    electricityCost: cost.electricityCostChf,
    depreciationCost: cost.depreciationCostChf,
    laborCost: cost.laborCostChf,
    errorRateCost: cost.errorRateCostChf,
    markupCost: roundChf(cost.endPriceChf - cost.subtotalWithErrorChf),
    multiColorSurcharge: roundChf(multiColorSurcharge),
    colorCount: Math.max(1, colorCount),
    unitPrice: roundChf(unitPrice),
    totalPrice: roundChf(totalPrice),
    subtotalWithErrorChf: cost.subtotalWithErrorChf,
  }
}

/** @deprecated Alias — nutzt Legacy-Konfiguration. */
export function calculate3DPrintPrice(
  volumeCm3: number,
  quantity: number,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
  colorCount = 1
): PrintPriceBreakdown {
  return calculate3DPrintPriceLegacy(volumeCm3, quantity, config, colorCount)
}
