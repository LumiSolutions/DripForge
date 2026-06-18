import type {
  PrintCalculatorInput,
  PrintCalculatorSettings,
  PrintCostBreakdown,
} from "@/lib/admin/print-calculator-types"

function roundChf(value: number): number {
  return Math.round(value * 100) / 100
}

export function printTimeHoursFromParts(hours: number, minutes: number): number {
  return Math.max(0, hours) + Math.max(0, minutes) / 60
}

export function resolvePrinter(
  settings: PrintCalculatorSettings,
  printerId: string
) {
  return (
    settings.printers.find((p) => p.id === printerId) ??
    settings.printers.find((p) => p.id === settings.global.defaultPrinterId) ??
    settings.printers[0]
  )
}

export function resolveMaterial(
  settings: PrintCalculatorSettings,
  materialId: string
) {
  return (
    settings.materials.find((m) => m.id === materialId) ??
    settings.materials.find((m) => m.id === settings.global.defaultMaterialId) ??
    settings.materials[0]
  )
}

/** Interne Selbstkosten-Berechnung (CHF). */
export function calculatePrintCostBreakdown(
  settings: PrintCalculatorSettings,
  input: PrintCalculatorInput
): PrintCostBreakdown {
  const printer = resolvePrinter(settings, input.printerId)
  const material = resolveMaterial(settings, input.materialId)
  const { global } = settings

  if (!printer || !material) {
    throw new Error("Drucker- oder Materialprofil fehlt.")
  }

  const weightGrams = Math.max(0, input.weightGrams)
  const printTimeHours = printTimeHoursFromParts(input.printHours, input.printMinutes)
  const prepPostHours = Math.max(0, input.prepPostMinutes) / 60

  const rollWeightG = material.rollWeightKg * 1000
  const filamentCostChf =
    rollWeightG > 0 ? (weightGrams / rollWeightG) * material.rollPriceChf : 0

  const electricityCostChf =
    printTimeHours * printer.powerKw * global.electricityPriceChfPerKwh

  const hourlyDepreciation =
    printer.depreciationHours > 0
      ? printer.purchasePriceChf / printer.depreciationHours
      : 0
  const depreciationCostChf = printTimeHours * hourlyDepreciation

  const laborCostChf = prepPostHours * global.laborCostChfPerHour

  const subtotalChf =
    filamentCostChf + electricityCostChf + depreciationCostChf + laborCostChf

  const errorRateCostChf = subtotalChf * (global.errorRatePercent / 100)
  const subtotalWithErrorChf = subtotalChf + errorRateCostChf
  const endPriceChf = subtotalWithErrorChf * global.markupMultiplier

  return {
    printerName: printer.name,
    materialName: material.name,
    weightGrams: roundChf(weightGrams),
    printTimeHours: roundChf(printTimeHours),
    prepPostHours: roundChf(prepPostHours),
    filamentCostChf: roundChf(filamentCostChf),
    electricityCostChf: roundChf(electricityCostChf),
    depreciationCostChf: roundChf(depreciationCostChf),
    laborCostChf: roundChf(laborCostChf),
    subtotalChf: roundChf(subtotalChf),
    errorRateCostChf: roundChf(errorRateCostChf),
    subtotalWithErrorChf: roundChf(subtotalWithErrorChf),
    endPriceChf: roundChf(endPriceChf),
  }
}

export function buildAutoQuoteInput(
  settings: PrintCalculatorSettings,
  weightGrams: number,
  options?: { printerId?: string; materialId?: string }
): PrintCalculatorInput {
  const { global } = settings
  const printerId = options?.printerId ?? global.defaultPrinterId
  const materialId = options?.materialId ?? global.defaultMaterialId
  const safeWeight = Math.max(0, weightGrams)
  const printHoursFloat =
    global.defaultPrintGramsPerHour > 0
      ? safeWeight / global.defaultPrintGramsPerHour
      : 0
  const printHours = Math.floor(printHoursFloat)
  const printMinutes = Math.round((printHoursFloat - printHours) * 60)

  return {
    printerId,
    materialId,
    printHours,
    printMinutes,
    prepPostMinutes: global.defaultPrepPostMinutes,
    weightGrams: safeWeight,
  }
}

/** Geschätztes Filamentgewicht aus Bounding-Box-Volumen (Infill berücksichtigt). */
export function weightFromVolumeCm3(
  volumeCm3: number,
  densityGPerCm3: number,
  infillFactor = 0.15
): number {
  const safeInfill = Math.min(1, Math.max(0.01, infillFactor))
  return Math.max(0, volumeCm3 * densityGPerCm3 * safeInfill)
}

export function estimatePrintTimeHours(
  weightGrams: number,
  gramsPerHour: number
): number {
  if (gramsPerHour <= 0) return 0
  return Math.max(0, weightGrams) / gramsPerHour
}
