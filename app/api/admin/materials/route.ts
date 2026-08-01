import { NextResponse } from "next/server"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import {
  createMaterialInput,
  deleteMaterial,
  getMaterials,
  upsertMaterial,
} from "@/lib/admin/material-db"
import { normalizeMaterialItem } from "@/lib/admin/cosmos-materials"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { MaterialCategory, MaterialItem } from "@/lib/admin/material-types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") as MaterialCategory | null
    const seed = searchParams.get("seed") === "1"
    const materials = await getMaterials(
      category && ["filament", "lasermaterial", "sonstiges"].includes(category)
        ? category
        : undefined
    )

    // Manuelles Wiederherstellen der Lasermaterial-Stammdaten
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
    return NextResponse.json(
      { materials: [] },
      { headers: { "X-DripForge-Degraded": "1" } }
    )
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
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
    return NextResponse.json(
      { error: "Material konnte nicht erstellt werden." },
      { status: 500 }
    )
  }
}
