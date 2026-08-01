import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { reorderMaterials } from "@/lib/admin/material-db"
import { CosmosDatabaseError } from "@/lib/admin/storage-bridge"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as { orderedIds?: string[] }
    const orderedIds = Array.isArray(body.orderedIds)
      ? body.orderedIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : []
    if (orderedIds.length === 0) {
      return NextResponse.json(
        { error: "orderedIds fehlt oder ist leer." },
        { status: 400 }
      )
    }
    const materials = await reorderMaterials(orderedIds)
    return NextResponse.json({ materials })
  } catch (error) {
    console.error("Admin-API: Material-Reihenfolge konnte nicht gespeichert werden.", error)
    const status = error instanceof CosmosDatabaseError ? 503 : 500
    return NextResponse.json(
      {
        error:
          error instanceof CosmosDatabaseError
            ? "Lager-Datenbank (Cosmos) nicht erreichbar — Reihenfolge nicht gespeichert."
            : "Reihenfolge konnte nicht gespeichert werden.",
      },
      { status }
    )
  }
}
