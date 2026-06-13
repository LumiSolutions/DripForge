import { NextResponse } from "next/server"
import { getFilamentMaterials, getMaterialTypes } from "@/lib/admin/db"
import {
  buildDefaultMaterialTypes,
  getActiveMaterialTypes,
  typesToLegacyMap,
} from "@/lib/admin/material-stats-types"
import { legacyMaterialsFallback } from "@/lib/dripforge/filament-catalog"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const [materials, materialTypes] = await Promise.all([
      getFilamentMaterials(),
      getMaterialTypes(),
    ])
    const activeTypes = getActiveMaterialTypes(materialTypes)
    return NextResponse.json(
      {
        materials,
        materialTypes: activeTypes,
        materialStats: typesToLegacyMap(activeTypes),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Filaments API: Laden fehlgeschlagen.", formatCosmosError(error))
    const materialTypes = getActiveMaterialTypes(buildDefaultMaterialTypes())
    return NextResponse.json(
      {
        materials: legacyMaterialsFallback(materialTypes),
        materialTypes,
        materialStats: typesToLegacyMap(materialTypes),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  }
}
