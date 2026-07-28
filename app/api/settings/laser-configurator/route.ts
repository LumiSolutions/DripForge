import { NextResponse } from "next/server"
import { getLaserConfiguratorSettings } from "@/lib/admin/db"
import { createDefaultLaserConfiguratorSettings } from "@/lib/admin/laser-configurator-types"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const settings = await getLaserConfiguratorSettings()
    return NextResponse.json({
      allowCustomerShipping: settings.allowCustomerShipping,
      customerShippingInstructions: settings.customerShippingInstructions,
    })
  } catch (error) {
    console.error("Shop-API: Laser-Konfigurator-Einstellungen nicht verfügbar.", error)
    const defaults = createDefaultLaserConfiguratorSettings()
    return NextResponse.json({
      allowCustomerShipping: defaults.allowCustomerShipping,
      customerShippingInstructions: defaults.customerShippingInstructions,
    })
  }
}
