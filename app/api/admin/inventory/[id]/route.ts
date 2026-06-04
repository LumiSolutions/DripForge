import { NextResponse } from "next/server"
import {
  adjustInventoryStock,
  deleteInventoryMaterial,
  getInventoryMaterialById,
  upsertInventoryMaterial,
} from "@/lib/admin/inventory-db"
import type { InventoryUnit, StoredInventoryMaterial } from "@/lib/admin/inventory-types"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as {
      adjustBy?: number
      bestand?: number
      name?: string
      mindestbestand?: number
      einheit?: InventoryUnit
      lieferant?: string
    }

    if (typeof body.adjustBy === "number") {
      const material = await adjustInventoryStock(id, body.adjustBy)
      if (!material) {
        return NextResponse.json(
          { error: "Material nicht gefunden." },
          { status: 404 }
        )
      }
      return NextResponse.json({ material })
    }

    const current = await getInventoryMaterialById(id)
    if (!current) {
      return NextResponse.json(
        { error: "Material nicht gefunden." },
        { status: 404 }
      )
    }

    const next: StoredInventoryMaterial = {
      ...current,
      name: body.name?.trim() || current.name,
      bestand:
        typeof body.bestand === "number" ? body.bestand : current.bestand,
      mindestbestand:
        typeof body.mindestbestand === "number"
          ? body.mindestbestand
          : current.mindestbestand,
      einheit:
        body.einheit === "kg" || body.einheit === "Stück"
          ? body.einheit
          : current.einheit,
      lieferant:
        typeof body.lieferant === "string" ? body.lieferant.trim() : current.lieferant,
    }

    const saved = await upsertInventoryMaterial(next)
    return NextResponse.json({ material: saved })
  } catch (error) {
    console.error("Admin-API: Lager-Update fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Update fehlgeschlagen." },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const ok = await deleteInventoryMaterial(id)
    if (!ok) {
      return NextResponse.json(
        { error: "Material nicht gefunden." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin-API: Lager-Löschen fehlgeschlagen.", error)
    return NextResponse.json({ error: "Löschen fehlgeschlagen." }, { status: 500 })
  }
}
