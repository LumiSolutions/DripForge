import { NextResponse } from "next/server"
import { getMaterialTypes } from "@/lib/admin/db"
import {
  buildDefaultMaterialTypes,
  getActiveMaterialTypes,
} from "@/lib/admin/material-stats-types"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const materialTypes = getActiveMaterialTypes(await getMaterialTypes())
    return NextResponse.json(
      { materialTypes },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Material-Stats API: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { materialTypes: getActiveMaterialTypes(buildDefaultMaterialTypes()) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  }
}
