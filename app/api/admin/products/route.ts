import { NextResponse } from "next/server"
import { getProducts, upsertProduct } from "@/lib/admin/db"
import { normalizeAdminProductInput } from "@/lib/admin/normalize-product"
import type { AdminProduct } from "@/lib/admin/types"

export async function GET() {
  try {
    const products = await getProducts()
    return NextResponse.json({ products })
  } catch (error) {
    console.warn("Admin-API: Produkte konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Produkte konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AdminProduct> & {
      variantenText?: string
    }
    const product = normalizeAdminProductInput(body)
    const saved = await upsertProduct(product)
    return NextResponse.json({ product: saved }, { status: 201 })
  } catch (error) {
    console.warn("Admin-API: Produkt konnte nicht erstellt werden.", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Produkt konnte nicht erstellt werden.",
      },
      { status: 400 }
    )
  }
}
