import { NextResponse } from "next/server"
import { getOrders, getProducts, getSettings } from "@/lib/admin/db"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"
import { getSafeServiceVisibility } from "@/lib/admin/safe-defaults"
import { normalizeShopProducts } from "@/lib/dripforge/normalize-shop-product"
import { resolveTopProducts } from "@/lib/dripforge/resolve-top-products"
import { buildTopProductsHomepageSettings } from "@/lib/dripforge/top-products-settings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const [products, settings, orders] = await Promise.all([
      getProducts(),
      getSettings(),
      getOrders(),
    ])
    const topSettings = buildTopProductsHomepageSettings(settings)
    const services = getSafeServiceVisibility(settings.services)

    if (!topSettings.showTopProductsOnHomepage) {
      return NextResponse.json(
        {
          enabled: false,
          limit: topSettings.topProductsCount,
          products: [],
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      )
    }

    const topProducts = resolveTopProducts({
      products,
      orders,
      services,
      limit: topSettings.topProductsCount,
    })

    return NextResponse.json(
      {
        enabled: true,
        limit: topSettings.topProductsCount,
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
    return NextResponse.json({
      enabled: true,
      limit: 4,
      products: [],
    })
  }
}
