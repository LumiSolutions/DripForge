import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import { getMaterialTypes, saveMaterialTypes } from "@/lib/admin/db"
import { getMaterials } from "@/lib/admin/material-db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { countStockForMaterialType } from "@/lib/admin/list-sort-utils"
import {
  sanitizeMaterialTypesInput,
  type MaterialTypeDefinition,
} from "@/lib/admin/material-stats-types"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const materialTypes = await getMaterialTypes()
    return NextResponse.json({ materialTypes })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Material-Stats: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Material-Arten konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as {
      materialTypes?: MaterialTypeDefinition[]
      materialStats?: unknown
    }

    if (!Array.isArray(body.materialTypes)) {
      return NextResponse.json(
        { error: "Material-Arten fehlen." },
        { status: 400 }
      )
    }

    const existing = await getMaterialTypes()
    const existingIds = new Set(existing.map((type) => type.id))
    const nextIds = new Set(body.materialTypes.map((type) => type.id))
    const removed = existing.filter((type) => !nextIds.has(type.id))

    if (removed.length > 0) {
      const stockItems = await getMaterials("filament")
      for (const type of removed) {
        const count = countStockForMaterialType(stockItems, type)
        if (count > 0) {
          return NextResponse.json(
            {
              error: `«${type.name}» kann nicht gelöscht werden — ${count} Lagerartikel verknüpft.`,
            },
            { status: 409 }
          )
        }
      }
    }

    for (const type of body.materialTypes) {
      if (!type.id?.trim() || !type.name?.trim()) {
        return NextResponse.json(
          { error: "Jede Material-Art braucht ID und Name." },
          { status: 400 }
        )
      }
      if (!existingIds.has(type.id) && body.materialTypes.filter((t) => t.id === type.id).length > 1) {
        return NextResponse.json(
          { error: "Doppelte Material-Art-ID." },
          { status: 400 }
        )
      }
    }

    const materialTypes = sanitizeMaterialTypesInput(body.materialTypes)
    const saved = await saveMaterialTypes(materialTypes)
    return NextResponse.json({ materialTypes: saved })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Material-Stats: Speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Material-Arten konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
