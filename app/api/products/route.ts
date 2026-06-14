import { NextResponse } from "next/server"
import { getProducts, getSettings } from "@/lib/admin/db"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"
import { isProductActive } from "@/lib/admin/normalize-product"
import { getSafeServiceVisibility } from "@/lib/admin/safe-defaults"
import { normalizeShopProducts } from "@/lib/dripforge/normalize-shop-product"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const [products, settings] = await Promise.all([getProducts(), getSettings()])
    const services = getSafeServiceVisibility(settings.services)
    const activeProducts = products.filter((p) => {
      if (!isProductActive(p)) return false
      if (p.type === "3d" && !services.druck3d) return false
      if (p.type === "laser" && !services.lasergravur) return false
      return true
    })
    const normalized = normalizeShopProducts(activeProducts)
    return NextResponse.json(
      {
        products: normalized,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    )
  } catch (error) {
    console.error("Products API: Laden fehlgeschlagen.", formatCosmosError(error))
    return NextResponse.json({ products: [] })
  }
}
