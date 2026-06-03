import { NextResponse } from "next/server"
import { getProducts, getSettings } from "@/lib/admin/db"
import { isProductActive } from "@/lib/admin/normalize-product"

export async function GET() {
  try {
    const [products, settings] = await Promise.all([getProducts(), getSettings()])
    const activeProducts = products.filter((p) => {
      if (!isProductActive(p)) return false
      if (p.type === "3d" && !settings.services.druck3d) return false
      if (p.type === "laser" && !settings.services.lasergravur) return false
      return true
    })
    return NextResponse.json({ products: activeProducts })
  } catch (error) {
    console.warn("Shop-API: Produkte konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Produkte konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}
