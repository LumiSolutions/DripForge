import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { getSafeServiceVisibility } from "@/lib/admin/safe-defaults"
import { normalizeShopConfigurators } from "@/lib/dripforge/shop-configurators"
import { normalizeManagedCatalog } from "@/lib/dripforge/managed-catalog"
import { buildThemeInboundTourPublicSettings } from "@/lib/dripforge/theme-inbound-tour-settings"
import { buildRewardPointsPublicSettings } from "@/lib/dripforge/reward-points-settings"

export async function GET() {
  try {
    const settings = await getSettings()
    const services = getSafeServiceVisibility(settings.services)
    const shopConfigurators = normalizeShopConfigurators(
      settings.shopConfigurators,
      settings.services
    )
    return NextResponse.json({
      ...services,
      shopConfigurators,
      managedCatalog: normalizeManagedCatalog(
        settings.managedCatalog,
        services,
        shopConfigurators
      ),
      ...buildThemeInboundTourPublicSettings(settings),
      ...buildRewardPointsPublicSettings(settings),
    })
  } catch (error) {
    console.error("Services-API: Einstellungen konnten nicht geladen werden.", error)
    const services = getSafeServiceVisibility(null)
    const shopConfigurators = normalizeShopConfigurators(null, null)
    return NextResponse.json({
      ...services,
      shopConfigurators,
      managedCatalog: normalizeManagedCatalog(null, services, shopConfigurators),
      ...buildThemeInboundTourPublicSettings(null),
      ...buildRewardPointsPublicSettings(null),
    })
  }
}
