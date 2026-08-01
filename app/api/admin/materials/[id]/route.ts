import { NextResponse } from "next/server"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { deleteMaterial, getMaterialById, upsertMaterial } from "@/lib/admin/material-db"
import { normalizeMaterialItem } from "@/lib/admin/cosmos-materials"
import { CosmosDatabaseError } from "@/lib/admin/storage-bridge"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { MaterialItem } from "@/lib/admin/material-types"
import { addFullRollsToGrams } from "@/lib/admin/material-stock-utils"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const { id } = await context.params
    const material = await getMaterialById(decodeURIComponent(id))
    if (!material) {
      return NextResponse.json({ error: "Material nicht gefunden." }, { status: 404 })
    }
    return NextResponse.json({ material })
  } catch (error) {
    console.error("Admin-API: Material konnte nicht geladen werden.", error)
    const status = error instanceof CosmosDatabaseError ? 503 : 500
    return NextResponse.json(
      {
        error:
          error instanceof CosmosDatabaseError
            ? "Lager-Datenbank (Cosmos) nicht erreichbar."
            : "Material konnte nicht geladen werden.",
      },
      { status }
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const { id } = await context.params
    const materialId = decodeURIComponent(id)
    const current = await getMaterialById(materialId)
    if (!current) {
      return NextResponse.json({ error: "Material nicht gefunden." }, { status: 404 })
    }

    const body = (await request.json()) as Partial<MaterialItem> & {
      addRolls?: number
      setPartialGrams?: number
      adjustAvailable?: number
      stockTotal?: number
    }

    let next = normalizeMaterialItem({ ...current, ...body, id: materialId })

    if (typeof body.addRolls === "number" && body.addRolls !== 0) {
      const delta = addFullRollsToGrams(body.addRolls)
      next = {
        ...next,
        stockAvailable: Math.max(0, next.stockAvailable + delta),
      }
    }

    if (typeof body.setPartialGrams === "number" && body.setPartialGrams >= 0) {
      const partial = Math.round(body.setPartialGrams)
      const full = Math.floor(next.stockAvailable / 1000) * 1000
      next = { ...next, stockAvailable: full + partial }
    }

    if (typeof body.adjustAvailable === "number" && body.adjustAvailable !== 0) {
      next = {
        ...next,
        stockAvailable: Math.max(0, next.stockAvailable + Math.round(body.adjustAvailable)),
      }
    }

    if (body.stockTotal != null && body.stockAvailable == null) {
      const reserved = next.stockReserved
      const total = Math.max(0, Math.round(Number(body.stockTotal)))
      next = { ...next, stockAvailable: Math.max(0, total - reserved) }
    }

    const saved = await upsertMaterial(next)
    return NextResponse.json({ material: saved })
  } catch (error) {
    console.error("Admin-API: Material konnte nicht aktualisiert werden.", error)
    const status = error instanceof CosmosDatabaseError ? 503 : 500
    return NextResponse.json(
      {
        error:
          error instanceof CosmosDatabaseError
            ? "Lager-Datenbank (Cosmos) nicht erreichbar — Speichern abgebrochen (kein Dateisystem-Fallback)."
            : "Material konnte nicht aktualisiert werden.",
      },
      { status }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const { id } = await context.params
    const ok = await deleteMaterial(decodeURIComponent(id))
    if (!ok) {
      return NextResponse.json({ error: "Material nicht gefunden." }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin-API: Material konnte nicht gelöscht werden.", error)
    const status = error instanceof CosmosDatabaseError ? 503 : 500
    return NextResponse.json(
      {
        error:
          error instanceof CosmosDatabaseError
            ? "Lager-Datenbank (Cosmos) nicht erreichbar — Löschen abgebrochen."
            : "Material konnte nicht gelöscht werden.",
      },
      { status }
    )
  }
}
