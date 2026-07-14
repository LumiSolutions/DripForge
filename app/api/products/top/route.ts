import { NextResponse } from "next/server"
import { getProducts, getSettings } from "@/lib/admin/db"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"
import { isProductActive } from "@/lib/admin/normalize-product"
import { getSafeServiceVisibility } from "@/lib/admin/safe-defaults"
import { normalizeShopProducts } from "@/lib/dripforge/normalize-shop-product"

export const dynamic = "force-dynamic"

const MAX_TOP_PRODUCTS = 10

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const [products, settings] = await Promise.all([getProducts(), getSettings()])
    const services = getSafeServiceVisibility(settings.services)

    const topProducts = products
      .filter((product) => {
        if (!isProductActive(product)) return false
        if (!product.isTopProduct) return false
        if (product.type === "3d" && !services.druck3d) return false
        if (product.type === "laser" && !services.lasergravur) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name, "de-CH"))
      .slice(0, MAX_TOP_PRODUCTS)

    return NextResponse.json(
      {
        products: normalizeShopProducts(topProducts),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    )
  } catch (error) {
    console.error("Top-Products API: Laden fehlgeschlagen.", formatCosmosError(error))
    return NextResponse.json({ products: [] })
  }
}
