import { NextResponse } from "next/server"
import { getProductById, getSettings } from "@/lib/admin/db"
import { isProductActive } from "@/lib/admin/normalize-product"
import { getSafeServiceVisibility } from "@/lib/admin/safe-defaults"
import {
  isShopProductDocument,
  normalizeShopProduct,
} from "@/lib/dripforge/normalize-shop-product"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const productId = decodeURIComponent(id).trim()

    if (!productId) {
      return NextResponse.json({ error: "Produkt-ID fehlt." }, { status: 400 })
    }

    await warmCosmosInfrastructure()

    const [raw, settings] = await Promise.all([
      getProductById(productId),
      getSettings(),
    ])

    if (!raw || !isShopProductDocument(raw as Record<string, unknown>)) {
      console.error(
        "Fehler beim Laden des Produkts: Dokument fehlt oder docType ist nicht 'product'.",
        { productId }
      )
      return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 })
    }

    if (!isProductActive(raw)) {
      return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 })
    }

    const services = getSafeServiceVisibility(settings.services)
    if (raw.type === "3d" && !services.druck3d) {
      return NextResponse.json({ error: "Produkt nicht verfügbar." }, { status: 404 })
    }
    if (raw.type === "laser" && !services.lasergravur) {
      return NextResponse.json({ error: "Produkt nicht verfügbar." }, { status: 404 })
    }

    const product = normalizeShopProduct(raw)

    return NextResponse.json(
      { product },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Fehler beim Laden des Produkts:", error)
    return NextResponse.json(
      { error: "Produkt konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}
