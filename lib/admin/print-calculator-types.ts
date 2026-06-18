export const PRINT_CALCULATOR_DOC_ID = "print-calculator-settings"
export const PRINT_CALCULATOR_DOC_TYPE = "print-calculator-settings"

export type PrintCalculatorPrinterProfile = {
  id: string
  name: string
  purchasePriceChf: number
  depreciationHours: number
  /** Leistungsaufnahme in kW */
  powerKw: number
}

export type PrintCalculatorMaterialProfile = {
  id: string
  name: string
  rollPriceChf: number
  rollWeightKg: number
  densityGPerCm3: number
}

export type PrintCalculatorGlobalParams = {
  electricityPriceChfPerKwh: number
  errorRatePercent: number
  markupMultiplier: number
  laborCostChfPerHour: number
  /** Automatische Kunden-Offerte: Druckgeschwindigkeit */
  defaultPrintGramsPerHour: number
  /** Vorbereitung/Nacharbeit fuer Auto-Offerte (Minuten) */
  defaultPrepPostMinutes: number
  setupFeeChf: number
  multiColorSurchargePercentPerExtra: number
  defaultPrinterId: string
  defaultMaterialId: string
}

export type PrintCalculatorSettings = {
  printers: PrintCalculatorPrinterProfile[]
  materials: PrintCalculatorMaterialProfile[]
  global: PrintCalculatorGlobalParams
  updatedAt: string
}

export type PrintCalculatorInput = {
  printerId: string
  materialId: string
  printHours: number
  printMinutes: number
  prepPostMinutes: number
  weightGrams: number
}

export type PrintCostBreakdown = {
  printerName: string
  materialName: string
  weightGrams: number
  printTimeHours: number
  prepPostHours: number
  filamentCostChf: number
  electricityCostChf: number
  depreciationCostChf: number
  laborCostChf: number
  subtotalChf: number
  errorRateCostChf: number
  subtotalWithErrorChf: number
  endPriceChf: number
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clampMin(value: number, min: number): number {
  return Math.max(min, value)
}

export function createDefaultPrintCalculatorSettings(): PrintCalculatorSettings {
  const now = new Date().toISOString()
  const printers: PrintCalculatorPrinterProfile[] = [
    {
      id: "bambu-h2c",
      name: "Bambulab H2C",
      purchasePriceChf: 2500,
      depreciationHours: 5000,
      powerKw: 0.35,
    },
  ]
  const materials: PrintCalculatorMaterialProfile[] = [
    {
      id: "bambu-pla",
      name: "Bambulab PLA",
      rollPriceChf: 25,
      rollWeightKg: 1,
      densityGPerCm3: 1.24,
    },
  ]
  return {
    printers,
    materials,
    global: {
      electricityPriceChfPerKwh: 0.28,
      errorRatePercent: 8,
      markupMultiplier: 2,
      laborCostChfPerHour: 45,
      defaultPrintGramsPerHour: 12,
      defaultPrepPostMinutes: 15,
      setupFeeChf: 5,
      multiColorSurchargePercentPerExtra: 15,
      defaultPrinterId: printers[0].id,
      defaultMaterialId: materials[0].id,
    },
    updatedAt: now,
  }
}

function sanitizeProfileId(value: unknown, fallback: string): string {
  const raw = String(value ?? "").trim()
  return raw || fallback
}

export function sanitizePrintCalculatorSettings(
  input: Partial<PrintCalculatorSettings> | null | undefined
): PrintCalculatorSettings {
  const defaults = createDefaultPrintCalculatorSettings()
  if (!input) return defaults

  const printers = (input.printers ?? defaults.printers).map((p, index) => ({
    id: sanitizeProfileId(p.id, `printer-${index + 1}`),
    name: String(p.name ?? `Drucker ${index + 1}`).trim().slice(0, 120),
    purchasePriceChf: clampMin(num(p.purchasePriceChf), 0),
    depreciationHours: clampMin(num(p.depreciationHours, 1), 1),
    powerKw: clampMin(num(p.powerKw, 0.1), 0.01),
  }))

  const materials = (input.materials ?? defaults.materials).map((m, index) => ({
    id: sanitizeProfileId(m.id, `material-${index + 1}`),
    name: String(m.name ?? `Material ${index + 1}`).trim().slice(0, 120),
    rollPriceChf: clampMin(num(m.rollPriceChf), 0),
    rollWeightKg: clampMin(num(m.rollWeightKg, 0.1), 0.01),
    densityGPerCm3: clampMin(num(m.densityGPerCm3, 1.24), 0.01),
  }))

  const g = input.global ?? defaults.global
  const defaultPrinterId =
    printers.find((p) => p.id === g.defaultPrinterId)?.id ?? printers[0]?.id ?? ""
  const defaultMaterialId =
    materials.find((m) => m.id === g.defaultMaterialId)?.id ?? materials[0]?.id ?? ""

  return {
    printers: printers.length ? printers : defaults.printers,
    materials: materials.length ? materials : defaults.materials,
    global: {
      electricityPriceChfPerKwh: clampMin(num(g.electricityPriceChfPerKwh, 0.28), 0),
      errorRatePercent: clampMin(num(g.errorRatePercent), 0),
      markupMultiplier: clampMin(num(g.markupMultiplier, 2), 1),
      laborCostChfPerHour: clampMin(num(g.laborCostChfPerHour), 0),
      defaultPrintGramsPerHour: clampMin(num(g.defaultPrintGramsPerHour, 12), 0.1),
      defaultPrepPostMinutes: clampMin(num(g.defaultPrepPostMinutes, 15), 0),
      setupFeeChf: clampMin(num(g.setupFeeChf, 5), 0),
      multiColorSurchargePercentPerExtra: clampMin(
        num(g.multiColorSurchargePercentPerExtra, 15),
        0
      ),
      defaultPrinterId,
      defaultMaterialId,
    },
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
}

export function mergePrintCalculatorSettings(
  stored: Partial<PrintCalculatorSettings> | null | undefined
): PrintCalculatorSettings {
  const defaults = createDefaultPrintCalculatorSettings()
  if (!stored) return defaults
  return sanitizePrintCalculatorSettings({
    ...defaults,
    ...stored,
    global: { ...defaults.global, ...stored.global },
    printers: stored.printers?.length ? stored.printers : defaults.printers,
    materials: stored.materials?.length ? stored.materials : defaults.materials,
  })
}
