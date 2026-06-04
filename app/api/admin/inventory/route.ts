import { NextResponse } from "next/server"
import {
  createInventoryMaterialInput,
  getInventoryMaterials,
  upsertInventoryMaterial,
} from "@/lib/admin/inventory-db"
import type { InventoryUnit } from "@/lib/admin/inventory-types"

export async function GET() {
  try {
    const materials = await getInventoryMaterials()
    return NextResponse.json({ materials })
  } catch (error) {
    console.error("Admin-API: Lager konnte nicht geladen werden.", error)
    return NextResponse.json(
      { materials: [] },
      { headers: { "X-DripForge-Degraded": "1" } }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string
      bestand?: number
      mindestbestand?: number
      einheit?: InventoryUnit
      lieferant?: string
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name fehlt." }, { status: 400 })
    }

    const material = createInventoryMaterialInput({
      name: body.name,
      bestand: body.bestand,
      mindestbestand: body.mindestbestand,
      einheit: body.einheit,
      lieferant: body.lieferant,
    })

    const saved = await upsertInventoryMaterial(material)
    return NextResponse.json({ material: saved }, { status: 201 })
  } catch (error) {
    console.error("Admin-API: Lager-Material konnte nicht erstellt werden.", error)
    return NextResponse.json(
      { error: "Material konnte nicht erstellt werden." },
      { status: 500 }
    )
  }
}
