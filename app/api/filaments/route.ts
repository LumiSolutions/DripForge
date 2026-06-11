import { NextResponse } from "next/server"
import { getFilamentMaterials } from "@/lib/admin/db"
import { legacyMaterialsFallback } from "@/lib/dripforge/filament-catalog"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const materials = await getFilamentMaterials()
    return NextResponse.json(
      { materials },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Filaments API: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { materials: legacyMaterialsFallback() },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  }
}
