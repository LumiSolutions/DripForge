import {
  DEFAULT_LASER_PRICING_CONFIG,
  type LaserPricingConfig,
} from "@/lib/dripforge/laser-pricing-config"

export type LaserPriceBreakdown = {
  basePrice: number
  engravingAreaMm2: number
  areaSurcharge: number
  unitPrice: number
  totalPrice: number
}

export function calculateLaserPrice(
  basePrice: number,
  engravingAreaMm2: number,
  quantity: number,
  config: LaserPricingConfig = DEFAULT_LASER_PRICING_CONFIG
): LaserPriceBreakdown {
  const billableArea = Math.max(
    0,
    engravingAreaMm2 - config.freeEngravingAreaMm2
  )
  const areaSurcharge = billableArea * config.surchargePerMm2
  const unitPrice = basePrice + areaSurcharge
  const totalPrice = unitPrice * Math.max(1, quantity)

  return {
    basePrice,
    engravingAreaMm2,
    areaSurcharge,
    unitPrice,
    totalPrice,
  }
}
