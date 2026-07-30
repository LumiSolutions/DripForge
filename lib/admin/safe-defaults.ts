import { DEFAULT_CHECKOUT_RUNTIME_CONFIG } from "@/lib/dripforge/checkout-config"
import type { AdminSettings } from "@/lib/admin/types"
import {
  DEFAULT_LAUNCH_SETTINGS,
  DEFAULT_SERVICE_VISIBILITY,
  DEFAULT_SHOP_CONFIGURATORS,
} from "@/lib/admin/types"
import { normalizeServiceVisibility } from "@/lib/dripforge/service-visibility"
import { normalizeShopConfigurators } from "@/lib/dripforge/shop-configurators"
import { normalizeCompanySettings } from "@/lib/dripforge/company-settings"
import {
  DEFAULT_LOYALTY_EARN_PERCENT,
  DEFAULT_LOYALTY_EXPIRY_MONTHS,
} from "@/lib/konto/loyalty-points-config"
import { DEFAULT_ORDER_EMAIL_TEMPLATES } from "@/lib/email/order-email-templates"
import {
  DEFAULT_SHOW_TOP_PRODUCTS_ON_HOMEPAGE,
  DEFAULT_TOP_PRODUCTS_COUNT,
} from "@/lib/dripforge/top-products-settings"

/** Sichere Standard-Einstellungen wenn Cosmos/Datei nicht erreichbar sind. */
export function buildDefaultAdminSettings(): AdminSettings {
  return {
    checkout: { ...DEFAULT_CHECKOUT_RUNTIME_CONFIG },
    company: normalizeCompanySettings(null),
    launch: { ...DEFAULT_LAUNCH_SETTINGS },
    services: { ...DEFAULT_SERVICE_VISIBILITY },
    shopConfigurators: { ...DEFAULT_SHOP_CONFIGURATORS },
    showSupportOnMainSite: false,
    showSupportOnCountdownPage: false,
    enableOnboardingTour: true,
    onboardingTourText: "Tag-\noder\nNachtmodus?",
    themeInboundTourImageUrl: null,
    enableRewardPointsSystem: true,
    loyaltyEarnPercent: DEFAULT_LOYALTY_EARN_PERCENT,
    loyaltyPointsExpiryMonths: DEFAULT_LOYALTY_EXPIRY_MONTHS,
    showTopProductsOnHomepage: DEFAULT_SHOW_TOP_PRODUCTS_ON_HOMEPAGE,
    topProductsCount: DEFAULT_TOP_PRODUCTS_COUNT,
    orderEmailTemplates: { ...DEFAULT_ORDER_EMAIL_TEMPLATES },
    updatedAt: new Date().toISOString(),
  }
}

export function normalizeSupportFlag(value: unknown): boolean {
  return value === true
}

export function getSafeServiceVisibility(
  input?: Partial<AdminSettings["services"]> | null
) {
  return normalizeServiceVisibility(input ?? DEFAULT_SERVICE_VISIBILITY)
}
