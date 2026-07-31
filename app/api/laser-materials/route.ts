import { NextResponse } from "next/server"
import { getLaserMaterialTypes } from "@/lib/admin/db"
import {
  getActiveLaserMaterialTypes,
  laserTypeToStorefrontMaterial,
} from "@/lib/admin/laser-material-types"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"
import { laserMaterials } from "@/lib/dripforge/data"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const types = await getLaserMaterialTypes()
    const materials = getActiveLaserMaterialTypes(types).map(
      laserTypeToStorefrontMaterial
    )

    return NextResponse.json(
      {
        materials: materials.length > 0 ? materials : laserMaterials,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error(
      "Laser-Materials API: Laden fehlgeschlagen.",
      formatCosmosError(error)
    )
    return NextResponse.json(
      { materials: laserMaterials },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-DripForge-Degraded": "1",
        },
      }
    )
  }
}
