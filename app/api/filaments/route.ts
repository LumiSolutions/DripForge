import { NextResponse } from "next/server"
import { getFilamentMaterials, getMaterialStats } from "@/lib/admin/db"
import { buildDefaultMaterialStats } from "@/lib/admin/material-stats-types"
import { legacyMaterialsFallback } from "@/lib/dripforge/filament-catalog"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const [materials, materialStats] = await Promise.all([
      getFilamentMaterials(),
      getMaterialStats(),
    ])
    return NextResponse.json(
      { materials, materialStats },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Filaments API: Laden fehlgeschlagen.", formatCosmosError(error))
    const materialStats = buildDefaultMaterialStats()
    return NextResponse.json(
      { materials: legacyMaterialsFallback(materialStats), materialStats },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  }
}
