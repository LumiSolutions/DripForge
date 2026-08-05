import { NextResponse } from "next/server"
import { getOrders, getProducts, getSettings } from "@/lib/admin/db"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"
import { getSafeServiceVisibility } from "@/lib/admin/safe-defaults"
import { normalizeShopProducts } from "@/lib/dripforge/normalize-shop-product"
import { resolveTopProducts } from "@/lib/dripforge/resolve-top-products"
import { buildTopProductsHomepageSettings } from "@/lib/dripforge/top-products-settings"

/** CDN/browser: kurze Frische, danach stale-while-revalidate. */
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
}

export const revalidate = 60

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const [products, settings] = await Promise.all([
      getProducts(),
      getSettings(),
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
        { headers: CACHE_HEADERS }
      )
    }

    // Orders nur laden wenn die Sektion aktiv ist (schwerer Read).
    const orders = await getOrders()
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
      { headers: CACHE_HEADERS }
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
