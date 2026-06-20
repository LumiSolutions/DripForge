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

function buildFilamentPayload(
  materials: Awaited<ReturnType<typeof getFilamentMaterials>>,
  materialTypes: ReturnType<typeof getActiveMaterialTypes>
) {
  const activeTypes = getActiveMaterialTypes(materialTypes)
  const resolvedMaterials =
    materials.length > 0 ? materials : legacyMaterialsFallback(activeTypes)

  return {
    materials: resolvedMaterials,
    materialTypes: activeTypes,
    materialStats: typesToLegacyMap(activeTypes),
  }
}

export async function GET() {
  const defaults = buildDefaultMaterialTypes()

  try {
    await warmCosmosInfrastructure()
    const [materials, materialTypes] = await Promise.all([
      getFilamentMaterials(),
      getMaterialTypes(),
    ])

    return NextResponse.json(buildFilamentPayload(materials, materialTypes), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (error) {
    console.error("Filaments API: Laden fehlgeschlagen.", formatCosmosError(error))
    const materialTypes = getActiveMaterialTypes(defaults)
    return NextResponse.json(
      {
        materials: legacyMaterialsFallback(materialTypes),
        materialTypes,
        materialStats: typesToLegacyMap(materialTypes),
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0", "X-DripForge-Degraded": "1" },
      }
    )
  }
}
