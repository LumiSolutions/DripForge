import { NextResponse } from "next/server"
import { getIndividualPricingSettings } from "@/lib/admin/individual-pricing-db"
import { createDefaultIndividualPricingSettings } from "@/lib/admin/individual-pricing-types"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const settings = await getIndividualPricingSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error("Individual-Pricing: Lesen fehlgeschlagen.", error)
    return NextResponse.json(createDefaultIndividualPricingSettings(), {
      headers: { "X-DripForge-Degraded": "1" },
    })
  }
}
