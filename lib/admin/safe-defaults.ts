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
import {
  DEFAULT_WISHLIST_ICON,
} from "@/lib/dripforge/wishlist-icon-settings"
import { DEFAULT_ANNOUNCEMENT_BANNER } from "@/lib/dripforge/announcement-banner-settings"
import { DEFAULT_SHIPPING_TIERS } from "@/lib/dripforge/shipping-tiers"
import { DEFAULT_THANKS_PAGE_SETTINGS } from "@/lib/dripforge/thanks-page-settings"
import { DEFAULT_SEASONAL_SETTINGS } from "@/lib/dripforge/seasonal-events"

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
    requireAdmin2fa: true,
    wishlistIcon: DEFAULT_WISHLIST_ICON,
    wishlistIconCustomUrl: null,
    orderEmailTemplates: { ...DEFAULT_ORDER_EMAIL_TEMPLATES },
    orderEmailLayout: {
      ...DEFAULT_ORDER_EMAIL_LAYOUT,
      sectionOrder: [...DEFAULT_ORDER_EMAIL_LAYOUT.sectionOrder],
    },
    announcementBanner: { ...DEFAULT_ANNOUNCEMENT_BANNER },
    customerCategories: [],
    brandIconUrl: null,
    brandLogoUrl: null,
    emailSignature: "",
    shippingTiers: {
      ...DEFAULT_SHIPPING_TIERS,
      tiers: DEFAULT_SHIPPING_TIERS.tiers.map((t) => ({ ...t })),
    },
    thanksPage: { ...DEFAULT_THANKS_PAGE_SETTINGS },
    seasonal: {
      ...DEFAULT_SEASONAL_SETTINGS,
      events: DEFAULT_SEASONAL_SETTINGS.events.map((event) => ({ ...event })),
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
