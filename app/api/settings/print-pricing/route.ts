import { NextResponse } from "next/server"
import { getPrintCalculatorSettings } from "@/lib/admin/db"
import { createDefaultPrintCalculatorSettings } from "@/lib/admin/print-calculator-types"
import { calculate3DPrintPriceFromSettings } from "@/lib/dripforge/calculate-3d-print-price"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const settings = await getPrintCalculatorSettings()
    return NextResponse.json({
      configured: true,
      defaultMaterialId: settings.global.defaultMaterialId,
      defaultPrinterId: settings.global.defaultPrinterId,
      multiColorSurchargePercentPerExtra:
        settings.global.multiColorSurchargePercentPerExtra,
      setupFeeChf: settings.global.setupFeeChf,
      defaultInfillFactor: settings.global.defaultInfillFactor,
      defaultPrintGramsPerHour: settings.global.defaultPrintGramsPerHour,
      materials: settings.materials.map((m) => ({
        id: m.id,
        name: m.name,
        densityGPerCm3: m.densityGPerCm3,
      })),
    })
  } catch (error) {
    console.error("Shop-API: Druck-Preise nicht verfuegbar.", error)
    const defaults = createDefaultPrintCalculatorSettings()
    return NextResponse.json({
      configured: false,
      defaultMaterialId: defaults.global.defaultMaterialId,
      defaultPrinterId: defaults.global.defaultPrinterId,
      multiColorSurchargePercentPerExtra:
        defaults.global.multiColorSurchargePercentPerExtra,
      setupFeeChf: defaults.global.setupFeeChf,
      defaultInfillFactor: defaults.global.defaultInfillFactor,
      defaultPrintGramsPerHour: defaults.global.defaultPrintGramsPerHour,
      materials: defaults.materials.map((m) => ({
        id: m.id,
        name: m.name,
        densityGPerCm3: m.densityGPerCm3,
      })),
    })
  }
}

export async function POST(request: Request) {
  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as {
      volumeCm3?: number
      quantity?: number
      colorCount?: number
      materialId?: string
    }

    const volumeCm3 = Math.max(0, Number(body.volumeCm3) || 0)
    const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1))
    const colorCount = Math.max(1, Math.floor(Number(body.colorCount) || 1))

    if (volumeCm3 <= 0) {
      return NextResponse.json(
        { error: "Volumen muss groesser als 0 sein." },
        { status: 400 }
      )
    }

    const settings = await getPrintCalculatorSettings()
    const breakdown = calculate3DPrintPriceFromSettings(
      volumeCm3,
      quantity,
      settings,
      colorCount,
      body.materialId?.trim()
    )

    return NextResponse.json({ breakdown, settingsUpdatedAt: settings.updatedAt })
  } catch (error) {
    console.error("Shop-API: Druck-Offerte fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Preis konnte nicht berechnet werden." },
      { status: 500 }
    )
  }
}
