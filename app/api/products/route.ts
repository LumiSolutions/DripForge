import { NextResponse } from "next/server"
import { getProducts, getSettings } from "@/lib/admin/db"
import { isProductActive } from "@/lib/admin/normalize-product"
import { getSafeServiceVisibility } from "@/lib/admin/safe-defaults"

export async function GET() {
  try {
    const [products, settings] = await Promise.all([getProducts(), getSettings()])
    const services = getSafeServiceVisibility(settings.services)
    const activeProducts = products.filter((p) => {
      if (!isProductActive(p)) return false
      if (p.type === "3d" && !services.druck3d) return false
      if (p.type === "laser" && !services.lasergravur) return false
      return true
    })
    return NextResponse.json({ products: activeProducts })
  } catch (error) {
    console.error("Shop-API: Produkte konnten nicht geladen werden.", error)
    return NextResponse.json({ products: [] })
  }
}
