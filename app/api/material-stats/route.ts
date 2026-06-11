import { NextResponse } from "next/server"
import { getMaterialStats } from "@/lib/admin/db"
import { buildDefaultMaterialStats } from "@/lib/admin/material-stats-types"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const materialStats = await getMaterialStats()
    return NextResponse.json(
      { materialStats },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Material-Stats API: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { materialStats: buildDefaultMaterialStats() },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  }
}
