import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { getSafeServiceVisibility } from "@/lib/admin/safe-defaults"
import { normalizeShopConfigurators } from "@/lib/dripforge/shop-configurators"
import { buildThemeInboundTourPublicSettings } from "@/lib/dripforge/theme-inbound-tour-settings"

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json({
      ...getSafeServiceVisibility(settings.services),
      shopConfigurators: normalizeShopConfigurators(
        settings.shopConfigurators,
        settings.services
      ),
      ...buildThemeInboundTourPublicSettings(settings),
    })
  } catch (error) {
    console.error("Services-API: Einstellungen konnten nicht geladen werden.", error)
    return NextResponse.json({
      ...getSafeServiceVisibility(null),
      shopConfigurators: normalizeShopConfigurators(null, null),
      ...buildThemeInboundTourPublicSettings(null),
    })
  }
}
