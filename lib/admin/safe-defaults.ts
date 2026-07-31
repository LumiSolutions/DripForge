import { DEFAULT_CHECKOUT_RUNTIME_CONFIG } from "@/lib/dripforge/checkout-config"
import type { AdminSettings } from "@/lib/admin/types"
import {
  DEFAULT_LAUNCH_SETTINGS,
  DEFAULT_SERVICE_VISIBILITY,
  DEFAULT_SHOP_CONFIGURATORS,
} from "@/lib/admin/types"
import { normalizeServiceVisibility } from "@/lib/dripforge/service-visibility"
import { normalizeShopConfigurators } from "@/lib/dripforge/shop-configurators"
import { normalizeManagedCatalog } from "@/lib/dripforge/managed-catalog"
import { normalizeCompanySettings } from "@/lib/dripforge/company-settings"
import {
  DEFAULT_LOYALTY_EARN_PERCENT,
  DEFAULT_LOYALTY_EXPIRY_MONTHS,
  DEFAULT_LOYALTY_POINT_VALUE_CHF,
} from "@/lib/konto/loyalty-points-config"
import { DEFAULT_ORDER_EMAIL_TEMPLATES } from "@/lib/email/order-email-templates"
import { DEFAULT_ORDER_EMAIL_LAYOUT } from "@/lib/email/order-email-layout"
import {
  DEFAULT_SHOW_TOP_PRODUCTS_ON_HOMEPAGE,
  DEFAULT_TOP_PRODUCTS_COUNT,
} from "@/lib/dripforge/top-products-settings"
import {
  DEFAULT_SUPPORT_FEATURES,
  DEFAULT_SUPPORT_MILESTONES,
} from "@/lib/dripforge/support-page-settings"

/** Sichere Standard-Einstellungen wenn Cosmos/Datei nicht erreichbar sind. */
export function buildDefaultAdminSettings(): AdminSettings {
  return {
    checkout: { ...DEFAULT_CHECKOUT_RUNTIME_CONFIG },
    company: normalizeCompanySettings(null),
    launch: { ...DEFAULT_LAUNCH_SETTINGS },
    services: { ...DEFAULT_SERVICE_VISIBILITY },
    shopConfigurators: { ...DEFAULT_SHOP_CONFIGURATORS },
    managedCatalog: normalizeManagedCatalog(
      null,
      DEFAULT_SERVICE_VISIBILITY,
      DEFAULT_SHOP_CONFIGURATORS
    ),
    showSupportOnMainSite: false,
    showSupportOnCountdownPage: false,
    supportMilestones: DEFAULT_SUPPORT_MILESTONES.map((m) => ({ ...m })),
    supportFeatures: DEFAULT_SUPPORT_FEATURES.map((f) => ({ ...f })),
    enableOnboardingTour: true,
    onboardingTourText: "Tag-\noder\nNachtmodus?",
    themeInboundTourImageUrl: null,
    enableRewardPointsSystem: true,
    loyaltyEarnPercent: DEFAULT_LOYALTY_EARN_PERCENT,
    loyaltyPointValueChf: DEFAULT_LOYALTY_POINT_VALUE_CHF,
    loyaltyPointsExpiryMonths: DEFAULT_LOYALTY_EXPIRY_MONTHS,
    showTopProductsOnHomepage: DEFAULT_SHOW_TOP_PRODUCTS_ON_HOMEPAGE,
    topProductsCount: DEFAULT_TOP_PRODUCTS_COUNT,
    orderEmailTemplates: { ...DEFAULT_ORDER_EMAIL_TEMPLATES },
    orderEmailLayout: {
      ...DEFAULT_ORDER_EMAIL_LAYOUT,
      sectionOrder: [...DEFAULT_ORDER_EMAIL_LAYOUT.sectionOrder],
    },
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
