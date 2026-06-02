import { NextResponse } from "next/server"
import { getProducts } from "@/lib/admin/db"
import { isProductActive } from "@/lib/admin/normalize-product"

export async function GET() {
  try {
    const products = await getProducts()
    const activeProducts = products.filter(isProductActive)
    return NextResponse.json({ products: activeProducts })
  } catch (error) {
    console.warn("Shop-API: Produkte konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Produkte konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}
