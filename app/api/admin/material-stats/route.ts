import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import { getMaterialStats, saveMaterialStats } from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import {
  sanitizeMaterialStatsInput,
  type MaterialStatsMap,
} from "@/lib/admin/material-stats-types"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const materialStats = await getMaterialStats()
    return NextResponse.json({ materialStats })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Material-Stats: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Material-Stats konnten nicht geladen werden." },
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
      materialStats?: Partial<MaterialStatsMap>
    }
    if (!body.materialStats || typeof body.materialStats !== "object") {
      return NextResponse.json(
        { error: "Material-Stats fehlen." },
        { status: 400 }
      )
    }

    const existing = await getMaterialStats()
    const materialStats = sanitizeMaterialStatsInput({
      ...existing,
      ...body.materialStats,
    })
    const saved = await saveMaterialStats(materialStats)
    return NextResponse.json({ materialStats: saved })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Material-Stats: Speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Material-Stats konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
