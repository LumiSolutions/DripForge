import { NextResponse } from "next/server"
import {
  getInventoryContainer,
  isCosmosConfigured,
  logCosmosConfigStatus,
  warmCosmosInfrastructure,
} from "@/lib/cosmos/client"
import {
  createMaterialInput,
  getMaterials,
  upsertMaterial,
} from "@/lib/admin/material-db"
import { normalizeMaterialItem } from "@/lib/admin/cosmos-materials"
import { CosmosDatabaseError } from "@/lib/admin/storage-bridge"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { MaterialCategory, MaterialItem } from "@/lib/admin/material-types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function cosmosErrorResponse(error: unknown, fallbackMessage: string) {
  logCosmosConfigStatus()
  if (error instanceof CosmosDatabaseError) {
    return NextResponse.json(
      {
        error: isCosmosConfigured()
          ? "Lager-Container in Cosmos nicht erreichbar. Bitte Container «inventory» (Partition /id) im Azure Portal prüfen oder COSMOSDB_INVENTORY_CONTAINER setzen."
          : "Lager-Datenbank (Cosmos) nicht konfiguriert. Bitte COSMOSDB_ENDPOINT/COSMOSDB_KEY in den Azure App Settings setzen (Runtime, nicht nur CI-Build).",
        materials: [],
      },
      { status: 503 }
    )
  }
  return NextResponse.json({ error: fallbackMessage, materials: [] }, { status: 500 })
}

async function ensureMaterialsStorageReady(): Promise<void> {
  await warmCosmosInfrastructure()
  if (isCosmosConfigured()) {
    // Explizit inventory (oder settings-Fallback) vor Material-Queries warm machen
    await getInventoryContainer()
  }
}

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await ensureMaterialsStorageReady()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") as MaterialCategory | null
    const seed = searchParams.get("seed") === "1"
    const materials = await getMaterials(
      category && ["filament", "lasermaterial", "sonstiges"].includes(category)
        ? category
        : undefined
    )

    // Manuelles Laser-Seed nur wenn Kategorie leer — niemals Filamente, niemals Wipe.
    if (seed && category === "lasermaterial" && materials.length === 0) {
      const { ensureLaserStockMaterialsSeeded } = await import(
        "@/lib/admin/material-db"
      )
      const seeded = await ensureLaserStockMaterialsSeeded()
      return NextResponse.json({ materials: seeded, seeded: true })
    }

    return NextResponse.json({ materials })
  } catch (error) {
    console.error("Admin-API: Materialien konnten nicht geladen werden.", error)
    return cosmosErrorResponse(
      error,
      "Materialien konnten nicht geladen werden."
    )
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await ensureMaterialsStorageReady()
    const body = (await request.json()) as Partial<MaterialItem> & {
      name?: string
      category?: MaterialCategory
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name fehlt." }, { status: 400 })
    }

    const category =
      body.category && ["filament", "lasermaterial", "sonstiges"].includes(body.category)
        ? body.category
        : "filament"

    const existing = await getMaterials(category)
    const nextSortOrder =
      body.sortOrder != null && Number.isFinite(Number(body.sortOrder))
        ? Math.max(0, Math.round(Number(body.sortOrder)))
        : existing.reduce((max, item) => Math.max(max, item.sortOrder ?? 0), -1) +
          1

    const base = createMaterialInput({
      name: body.name,
      category,
      stockUnit: body.stockUnit,
      sortOrder: nextSortOrder,
    })

    const material = normalizeMaterialItem({
      ...base,
      ...body,
      id: base.id,
      name: body.name.trim(),
      sortOrder: nextSortOrder,
    })

    const saved = await upsertMaterial(material)
    return NextResponse.json({ material: saved }, { status: 201 })
  } catch (error) {
    console.error("Admin-API: Material konnte nicht erstellt werden.", error)
    return cosmosErrorResponse(
      error,
      "Material konnte nicht erstellt werden."
    )
  }
}
