import { promises as fs } from "fs"
import path from "path"
import {
  DEFAULT_CHECKOUT_RUNTIME_CONFIG,
  normalizeCheckoutRuntimeConfig,
} from "@/lib/dripforge/checkout-config"
import { reconcilePortalAccounts } from "@/lib/konto/crm-sync"
import type {
  AdminProduct,
  AdminSettings,
  CompanySettings,
  LaunchSettings,
  ProductionStatus,
  StoredCustomer,
  StoredOrder,
} from "@/lib/admin/types"
import {
  DEFAULT_LAUNCH_SETTINGS,
  DEFAULT_SERVICE_VISIBILITY,
  DEFAULT_SHOP_CONFIGURATORS,
} from "@/lib/admin/types"
import { normalizeShopConfigurators } from "@/lib/dripforge/shop-configurators"
import { normalizeServiceVisibility } from "@/lib/dripforge/service-visibility"
import {
  applyManagedCatalogToSettings,
  normalizeManagedCatalog,
  type ManagedCatalogItem,
} from "@/lib/dripforge/managed-catalog"
import {
  buildDefaultAdminSettings,
  normalizeSupportFlag,
} from "@/lib/admin/safe-defaults"
import { buildSupportPageSettings } from "@/lib/dripforge/support-page-settings"
import {
  normalizeSupportFeatures,
  normalizeSupportMilestones,
} from "@/lib/dripforge/support-page-settings"
import {
  normalizeEnableOnboardingTour,
  normalizeOnboardingTourText,
  normalizeThemeInboundTourImageUrl,
  DEFAULT_ONBOARDING_TOUR_TEXT,
} from "@/lib/dripforge/theme-inbound-tour-settings"
import { normalizeLaunchSettings } from "@/lib/dripforge/countdown-settings"
import { normalizeEnableRewardPointsSystem } from "@/lib/dripforge/reward-points-settings"
import { normalizeCompanySettings } from "@/lib/dripforge/company-settings"
import {
  DEFAULT_LOYALTY_EARN_PERCENT,
  DEFAULT_LOYALTY_EXPIRY_MONTHS,
  DEFAULT_LOYALTY_POINT_VALUE_CHF,
  normalizeLoyaltyEarnPercent,
  normalizeLoyaltyExpiryMonths,
  normalizeLoyaltyPointValueChf,
} from "@/lib/konto/loyalty-points-config"
import { normalizeOrderEmailTemplates } from "@/lib/email/order-email-templates"
import { normalizeOrderEmailLayout } from "@/lib/email/order-email-layout"
import {
  DEFAULT_SHOW_TOP_PRODUCTS_ON_HOMEPAGE,
  DEFAULT_TOP_PRODUCTS_COUNT,
  normalizeShowTopProductsOnHomepage,
  normalizeTopProductsCount,
} from "@/lib/dripforge/top-products-settings"
import {
  DEFAULT_WISHLIST_ICON,
  normalizeWishlistIcon,
  normalizeWishlistIconCustomUrl,
} from "@/lib/dripforge/wishlist-icon-settings"
import {
  CosmosDatabaseError,
  withCosmosFallback,
  withCosmosRequired,
} from "@/lib/admin/storage-bridge"
import { resetCosmosCaches } from "@/lib/cosmos/client"
import { resetOrdersContainerCache } from "@/lib/cosmos/orders-container"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  isCosmosConfigured,
  cosmosGetCustomers,
  cosmosGetCustomerByNumber,
  cosmosGetOrderById,
  cosmosGetOrders,
  cosmosDeleteOrder,
  cosmosDeleteProduct,
  cosmosGetProductById,
  cosmosGetProducts,
  cosmosGetSettings,
  cosmosSaveOrder,
  cosmosSaveSettings,
  cosmosUpsertProduct,
  cosmosUpdateOrderInvoice,
  cosmosUpdateOrderEmailNotifications,
  cosmosUpdateOrderProductionStatus,
  cosmosUpdateOrderShipment,
  cosmosUpdateOrderStatus,
  cosmosUpsertCustomerFromOrder,
} from "@/lib/admin/cosmos-store"
import {
  cosmosGetSiteConfigMeta,
  cosmosGetSiteConfigProduction,
  cosmosGetSiteConfigStaging,
  cosmosPublishSiteConfig,
  cosmosSaveSiteConfigStaging,
  type SiteConfigBundle,
} from "@/lib/admin/cosmos-site-config"
import {
  cosmosGetSiteTexts,
  cosmosSaveSiteTexts,
} from "@/lib/admin/cosmos-site-texts"
import {
  cosmosGetFilamentMaterials,
} from "@/lib/admin/cosmos-filaments"
import {
  cosmosGetLaserMaterialTypes,
  cosmosGetMaterialStats,
  cosmosGetMaterialTypes,
  cosmosSaveLaserMaterialTypes,
  cosmosSaveMaterialStats,
  cosmosSaveMaterialTypes,
} from "@/lib/admin/cosmos-material-stats"
import {
  cosmosGetAiSettings,
  cosmosSaveAiSettings,
} from "@/lib/admin/cosmos-ai-settings"
import {
  cosmosGetDocumentTemplateSettings,
  cosmosSaveDocumentTemplateSettings,
} from "@/lib/admin/cosmos-invoice-template"
import {
  cosmosGetPrintCalculatorSettings,
  cosmosSavePrintCalculatorSettings,
} from "@/lib/admin/cosmos-print-calculator"
import {
  cosmosGetLaserConfiguratorSettings,
  cosmosSaveLaserConfiguratorSettings,
} from "@/lib/admin/cosmos-laser-configurator"
import {
  mergePrintCalculatorSettings,
  type PrintCalculatorSettings,
} from "@/lib/admin/print-calculator-types"
import {
  mergeLaserConfiguratorSettings,
  type LaserConfiguratorSettings,
} from "@/lib/admin/laser-configurator-types"
import { mergeAiSettings, type AiSettingsDocument } from "@/lib/ai/ai-settings-types"
import {
  mergeDocumentTemplateSettings,
  type DocumentTemplateSettings,
} from "@/lib/documents/document-template-types"
import { mergeSiteTexts, sanitizeSiteTextsInput, type SiteTexts } from "@/lib/admin/site-texts"
import {
  mergeSiteImages,
  sanitizeSiteImagesInput,
  type SiteImages,
} from "@/lib/admin/site-images"
import {
  mergeSiteLinks,
  sanitizeSiteLinksInput,
  type SiteLinks,
} from "@/lib/admin/site-links"
import {
  mergeCmsNavItems,
  mergeCmsPages,
  sanitizeCmsNavItemsInput,
  type CmsNavItem,
  type CmsPageEntry,
} from "@/lib/admin/site-nav"
import {
  mergeCmsFaqItems,
  sanitizeCmsFaqItemsInput,
  type CmsFaqItem,
} from "@/lib/admin/cms-faq"
import {
  getDefaultCmsPageContentLists,
  mergeCmsPageContentLists,
  type CmsContactField,
  type CmsExpectItem,
  type CmsProcessStep,
} from "@/lib/admin/cms-page-content"
import type { AdminFilament } from "@/lib/admin/filament-types"
import {
  mergeLaserMaterialTypes,
  type LaserMaterialTypeDefinition,
} from "@/lib/admin/laser-material-types"
import {
  mergeMaterialStats,
  mergeMaterialTypes,
  typesToLegacyMap,
  type MaterialStatsMap,
  type MaterialTypeDefinition,
} from "@/lib/admin/material-stats-types"
import type { FilamentMaterial } from "@/lib/dripforge/types"
import { getMaterials } from "@/lib/admin/material-db"

const DATA_DIR = path.join(process.cwd(), "data", "admin")

const ORDERS_FILE = "orders.json"
const PRODUCTS_FILE = "products.json"
const SETTINGS_FILE = "settings.json"
const SITE_TEXTS_FILE = "site-texts.json"
const SITE_CONFIG_STAGING_FILE = "site-config-staging.json"
const SITE_CONFIG_PRODUCTION_FILE = "site-config-production.json"
const FILAMENTS_FILE = "filaments.json"
const MATERIAL_STATS_FILE = "material-stats.json"
const AI_SETTINGS_FILE = "ai-settings.json"
const DOCUMENT_TEMPLATE_FILE = "document-template.json"
const LEGACY_INVOICE_TEMPLATE_FILE = "invoice-template.json"
const PRINT_CALCULATOR_FILE = "print-calculator-settings.json"
const LASER_CONFIGURATOR_FILE = "laser-configurator-settings.json"
async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
  } catch (error) {
    console.error(
      `Dateispeicher: Schreiben fehlgeschlagen (${filename}) — auf Azure ist oft nur Cosmos DB persistent.`,
      error
    )
    throw error
  }
}

async function getOrdersFromFile(): Promise<StoredOrder[]> {
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  return orders.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function getOrders(): Promise<StoredOrder[]> {
  try {
    return await withCosmosFallback("getOrders", cosmosGetOrders, getOrdersFromFile)
  } catch (error) {
    logCosmosError("getOrders:total-failure", error)
    return []
  }
}

export async function getOrderById(orderId: string): Promise<StoredOrder | null> {
  return withCosmosFallback(
    "getOrderById",
    () => cosmosGetOrderById(orderId),
    async () => {
      const orders = await getOrdersFromFile()
      return orders.find((o) => o.orderId === orderId) ?? null
    }
  )
}

async function saveOrderToFile(order: StoredOrder): Promise<void> {
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  orders.unshift(order)
  await writeJsonFile(ORDERS_FILE, orders)
}

export async function saveOrder(order: StoredOrder): Promise<void> {
  // Primär Cosmos wenn konfiguriert. Kein stiller Dateisystem-Fallback auf Azure —
  // sonst entstehen Treuepunkte ohne persistente Bestellung.
  if (!isCosmosConfigured()) {
    const { normalizeOrderForPersistence } = await import(
      "@/lib/admin/normalize-order"
    )
    const normalized = normalizeOrderForPersistence(order)
    await saveOrderToFile(normalized)
    console.info(`Bestellung gespeichert im Dateisystem (${normalized.orderId}).`)
    return
  }

  try {
    await cosmosSaveOrder(order)
    console.info(`Bestellung gespeichert in Cosmos DB (${order.orderId}).`)
    return
  } catch (firstError) {
    console.error("Fehler beim Speichern der Bestellung:", firstError)
    logCosmosError("saveOrder:first-attempt", firstError)
    console.warn(
      `Bestellung: Cosmos-Schreibversuch 1 fehlgeschlagen (${order.orderId}) — Cache-Reset & Retry.`
    )
    resetCosmosCaches()
    resetOrdersContainerCache()
  }

  try {
    await cosmosSaveOrder(order)
    console.info(
      `Bestellung gespeichert in Cosmos DB nach Retry (${order.orderId}).`
    )
  } catch (retryError) {
    console.error("Fehler beim Speichern der Bestellung:", retryError)
    logCosmosError("saveOrder:retry-failed", retryError)
    throw new CosmosDatabaseError("saveOrder", retryError)
  }
}

async function deleteOrderFromFile(orderId: string): Promise<boolean> {
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  const next = orders.filter((o) => o.orderId !== orderId)
  if (next.length === orders.length) return false
  await writeJsonFile(ORDERS_FILE, next)
  return true
}

export async function deleteOrder(orderId: string): Promise<boolean> {
  const trimmed = orderId.trim()
  if (!trimmed) return false
  return withCosmosFallback(
    "deleteOrder",
    () => cosmosDeleteOrder(trimmed),
    () => deleteOrderFromFile(trimmed)
  )
}

export async function upsertCustomerFromOrder(
  order: StoredOrder
): Promise<StoredCustomer> {
  // Shop-Checkout: CRM ist sekundär. Bei Cosmos-Fehlern lokalen Kunden ableiten,
  // statt den Checkout mit «Datenbank nicht erreichbar» abzubrechen.
  if (!isCosmosConfigured()) {
    const { buildCustomerFromOrder, generateCustomerNumber } = await import(
      "@/lib/admin/customers"
    )
    return buildCustomerFromOrder(
      order,
      order.kundennummer?.trim() || generateCustomerNumber([])
    )
  }

  try {
    return await cosmosUpsertCustomerFromOrder(order)
  } catch (error) {
    logCosmosError("upsertCustomerFromOrder", error)
    console.error(
      `CRM: upsertCustomerFromOrder fehlgeschlagen (${order.orderId}) — Fallback ohne CRM-Persistenz.`,
      error
    )
    const { buildCustomerFromOrder, generateCustomerNumber } = await import(
      "@/lib/admin/customers"
    )
    return buildCustomerFromOrder(
      order,
      order.kundennummer?.trim() || generateCustomerNumber([])
    )
  }
}

export async function getCustomers(): Promise<StoredCustomer[]> {
  await reconcilePortalAccounts()
  return withCosmosRequired("getCustomers", cosmosGetCustomers)
}

export async function getCustomerByNumber(
  kundennummer: string
): Promise<StoredCustomer | null> {
  return withCosmosRequired("getCustomerByNumber", () =>
    cosmosGetCustomerByNumber(kundennummer)
  )
}

async function updateOrderStatusInFile(
  orderId: string,
  status: StoredOrder["status"]
): Promise<StoredOrder | null> {
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  const index = orders.findIndex((o) => o.orderId === orderId)
  if (index === -1) return null
  orders[index] = { ...orders[index], status }
  await writeJsonFile(ORDERS_FILE, orders)
  return orders[index]
}

export async function updateOrderStatus(
  orderId: string,
  status: StoredOrder["status"]
): Promise<StoredOrder | null> {
  return withCosmosFallback(
    "updateOrderStatus",
    () => cosmosUpdateOrderStatus(orderId, status),
    () => updateOrderStatusInFile(orderId, status)
  )
}

async function updateOrderProductionStatusInFile(
  orderId: string,
  productionStatus: ProductionStatus
): Promise<StoredOrder | null> {
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  const index = orders.findIndex((o) => o.orderId === orderId)
  if (index === -1) return null
  orders[index] = { ...orders[index], productionStatus }
  await writeJsonFile(ORDERS_FILE, orders)
  return orders[index]
}

export async function updateOrderProductionStatus(
  orderId: string,
  productionStatus: ProductionStatus
): Promise<StoredOrder | null> {
  return withCosmosFallback(
    "updateOrderProductionStatus",
    () => cosmosUpdateOrderProductionStatus(orderId, productionStatus),
    () => updateOrderProductionStatusInFile(orderId, productionStatus)
  )
}

async function updateOrderShipmentInFile(
  orderId: string,
  data: Partial<Pick<StoredOrder, "productionStatus" | "trackingNumber" | "status">>
): Promise<StoredOrder | null> {
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  const index = orders.findIndex((o) => o.orderId === orderId)
  if (index === -1) return null
  orders[index] = { ...orders[index], ...data }
  await writeJsonFile(ORDERS_FILE, orders)
  return orders[index]
}

export async function updateOrderShipmentDetails(
  orderId: string,
  data: Partial<Pick<StoredOrder, "productionStatus" | "trackingNumber" | "status">>
): Promise<StoredOrder | null> {
  return withCosmosFallback(
    "updateOrderShipmentDetails",
    () => cosmosUpdateOrderShipment(orderId, data),
    () => updateOrderShipmentInFile(orderId, data)
  )
}

async function updateOrderInvoiceInFile(
  orderId: string,
  data: Pick<
    StoredOrder,
    "rechnungPdfUrl" | "rechnungPdfPath" | "kundennummer" | "invoiceNumber"
  >
): Promise<StoredOrder | null> {
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  const index = orders.findIndex((o) => o.orderId === orderId)
  if (index === -1) return null
  orders[index] = { ...orders[index], ...data }
  await writeJsonFile(ORDERS_FILE, orders)
  return orders[index]
}

export async function updateOrderInvoice(
  orderId: string,
  data: Pick<
    StoredOrder,
    "rechnungPdfUrl" | "rechnungPdfPath" | "kundennummer" | "invoiceNumber"
  >
): Promise<StoredOrder | null> {
  return withCosmosFallback(
    "updateOrderInvoice",
    () => cosmosUpdateOrderInvoice(orderId, data),
    () => updateOrderInvoiceInFile(orderId, data)
  )
}

async function updateOrderEmailNotificationsInFile(
  orderId: string,
  patch: Partial<NonNullable<StoredOrder["emailNotifications"]>>
): Promise<StoredOrder | null> {
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  const index = orders.findIndex((o) => o.orderId === orderId)
  if (index === -1) return null
  orders[index] = {
    ...orders[index],
    emailNotifications: {
      ...orders[index].emailNotifications,
      ...patch,
    },
  }
  await writeJsonFile(ORDERS_FILE, orders)
  return orders[index]
}

export async function updateOrderEmailNotifications(
  orderId: string,
  patch: Partial<NonNullable<StoredOrder["emailNotifications"]>>
): Promise<StoredOrder | null> {
  return withCosmosFallback(
    "updateOrderEmailNotifications",
    () => cosmosUpdateOrderEmailNotifications(orderId, patch),
    () => updateOrderEmailNotificationsInFile(orderId, patch)
  )
}

export function getLocalInvoicePath(filename: string): string {
  return path.join(DATA_DIR, "invoices", filename)
}

export async function readLocalInvoicePdf(filename: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(getLocalInvoicePath(filename))
  } catch {
    return null
  }
}

async function getProductsFromFile(): Promise<AdminProduct[]> {
  const stored = await readJsonFile<AdminProduct[] | null>(PRODUCTS_FILE, null)
  // Niemals Demo-Produkte automatisch schreiben — leeres Lager bleibt leer.
  if (Array.isArray(stored)) return stored
  return []
}

/** Shop-Storefront: Lesen mit Datei-Fallback. */
export async function getProducts(): Promise<AdminProduct[]> {
  try {
    return await withCosmosFallback("getProducts", cosmosGetProducts, getProductsFromFile)
  } catch (error) {
    logCosmosError("getProducts:total-failure", error)
    return getProductsFromFile().catch(() => [])
  }
}

/** Admin-Produktverwaltung: alle Produkte inkl. inaktive — nur Cosmos. */
export async function getAdminProducts(): Promise<AdminProduct[]> {
  return withCosmosRequired("getAdminProducts", cosmosGetProducts)
}

export async function getAdminProductById(id: string): Promise<AdminProduct | null> {
  return withCosmosRequired("getAdminProductById", () => cosmosGetProductById(id))
}

/** Storefront: Einzelprodukt mit Datei-Fallback. */
export async function getProductById(id: string): Promise<AdminProduct | null> {
  return withCosmosFallback(
    "getProductById",
    () => cosmosGetProductById(id),
    async () => {
      const products = await getProductsFromFile()
      return products.find((p) => p.id === id) ?? null
    }
  )
}

export async function upsertProduct(product: AdminProduct): Promise<AdminProduct> {
  const next: AdminProduct = {
    ...product,
    updatedAt: new Date().toISOString(),
  }
  return withCosmosRequired("upsertProduct", () => cosmosUpsertProduct(next))
}

export async function deleteProduct(id: string): Promise<boolean> {
  return withCosmosRequired("deleteProduct", () => cosmosDeleteProduct(id))
}

async function getSettingsFromFile(): Promise<AdminSettings> {
  const stored = await readJsonFile<AdminSettings | null>(SETTINGS_FILE, null)
  if (stored?.checkout) {
    const services = normalizeServiceVisibility(stored.services)
    const shopConfigurators = normalizeShopConfigurators(
      stored.shopConfigurators,
      services
    )
    return {
      checkout: normalizeCheckoutRuntimeConfig(stored.checkout),
      company: normalizeCompanySettings(stored.company),
    launch: normalizeLaunchSettings(stored.launch),
      services,
      shopConfigurators,
      managedCatalog: normalizeManagedCatalog(
        stored.managedCatalog,
        services,
        shopConfigurators
      ),
      ...buildSupportPageSettings(stored),
      supportMilestones: normalizeSupportMilestones(stored.supportMilestones),
      supportFeatures: normalizeSupportFeatures(stored.supportFeatures),
      enableOnboardingTour: normalizeEnableOnboardingTour(
        stored.enableOnboardingTour ??
          (stored as { enableThemeInboundTour?: boolean }).enableThemeInboundTour
      ),
      onboardingTourText: normalizeOnboardingTourText(stored.onboardingTourText),
      themeInboundTourImageUrl: normalizeThemeInboundTourImageUrl(
        stored.themeInboundTourImageUrl
      ),
      enableRewardPointsSystem: normalizeEnableRewardPointsSystem(
        stored.enableRewardPointsSystem
      ),
      loyaltyEarnPercent: normalizeLoyaltyEarnPercent(
        stored.loyaltyEarnPercent ?? DEFAULT_LOYALTY_EARN_PERCENT
      ),
      loyaltyPointValueChf: normalizeLoyaltyPointValueChf(
        stored.loyaltyPointValueChf ?? DEFAULT_LOYALTY_POINT_VALUE_CHF
      ),
      loyaltyPointsExpiryMonths: normalizeLoyaltyExpiryMonths(
        stored.loyaltyPointsExpiryMonths ?? DEFAULT_LOYALTY_EXPIRY_MONTHS
      ),
      showTopProductsOnHomepage: normalizeShowTopProductsOnHomepage(
        stored.showTopProductsOnHomepage
      ),
      topProductsCount: normalizeTopProductsCount(
        stored.topProductsCount ?? DEFAULT_TOP_PRODUCTS_COUNT
      ),
      requireAdmin2fa: stored.requireAdmin2fa !== false,
      wishlistIcon: normalizeWishlistIcon(stored.wishlistIcon),
      wishlistIconCustomUrl: normalizeWishlistIconCustomUrl(
        stored.wishlistIconCustomUrl
      ),
      orderEmailTemplates: normalizeOrderEmailTemplates(
        stored.orderEmailTemplates
      ),
      orderEmailLayout: normalizeOrderEmailLayout(stored.orderEmailLayout),
      updatedAt: stored.updatedAt,
    }
  }
  const defaults: AdminSettings = {
    checkout: { ...DEFAULT_CHECKOUT_RUNTIME_CONFIG },
    company: normalizeCompanySettings(null),
    launch: { ...DEFAULT_LAUNCH_SETTINGS },
    services: { ...DEFAULT_SERVICE_VISIBILITY },
    shopConfigurators: normalizeShopConfigurators(null, DEFAULT_SERVICE_VISIBILITY),
    managedCatalog: normalizeManagedCatalog(
      null,
      DEFAULT_SERVICE_VISIBILITY,
      DEFAULT_SHOP_CONFIGURATORS
    ),
    showSupportOnMainSite: false,
    showSupportOnCountdownPage: false,
    supportMilestones: normalizeSupportMilestones(undefined),
    supportFeatures: normalizeSupportFeatures(undefined),
    enableOnboardingTour: true,
    onboardingTourText: DEFAULT_ONBOARDING_TOUR_TEXT,
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
    orderEmailTemplates: normalizeOrderEmailTemplates(undefined),
    orderEmailLayout: normalizeOrderEmailLayout(undefined),
    updatedAt: new Date().toISOString(),
  }
  // Fehlende settings.json: Defaults nur im Speicher — kein Auto-Write bei Restart.
  return defaults
}

export async function getSettings(): Promise<AdminSettings> {
  try {
    return await withCosmosFallback("getSettings", cosmosGetSettings, getSettingsFromFile)
  } catch (error) {
    logCosmosError("getSettings:total-failure", error)
    return buildDefaultAdminSettings()
  }
}

export async function saveSettings(input: {
  checkout: AdminSettings["checkout"]
  company?: CompanySettings
  launch?: Partial<LaunchSettings>
  services?: Partial<AdminSettings["services"]>
  shopConfigurators?: Partial<AdminSettings["shopConfigurators"]>
  managedCatalog?: ManagedCatalogItem[] | null
  showSupportOnMainSite?: boolean
  showSupportOnCountdownPage?: boolean
  supportMilestones?: AdminSettings["supportMilestones"]
  supportFeatures?: AdminSettings["supportFeatures"]
  enableOnboardingTour?: boolean
  onboardingTourText?: string | null
  themeInboundTourImageUrl?: string | null
  enableRewardPointsSystem?: boolean
  loyaltyEarnPercent?: number
  loyaltyPointValueChf?: number
  loyaltyPointsExpiryMonths?: number
  showTopProductsOnHomepage?: boolean
  topProductsCount?: number
  requireAdmin2fa?: boolean
  wishlistIcon?: AdminSettings["wishlistIcon"]
  wishlistIconCustomUrl?: string | null
  orderEmailTemplates?: {
    receivedIntro?: string
    receivedFooter?: string
  }
  orderEmailLayout?: unknown
}): Promise<AdminSettings> {
  const current = await getSettings()

  let services: AdminSettings["services"]
  let shopConfigurators: AdminSettings["shopConfigurators"]
  let managedCatalog: ManagedCatalogItem[]

  if (input.managedCatalog !== undefined && input.managedCatalog !== null) {
    const applied = applyManagedCatalogToSettings(input.managedCatalog)
    services = applied.services
    shopConfigurators = applied.shopConfigurators
    managedCatalog = applied.managedCatalog
  } else {
    services = normalizeServiceVisibility({
      ...current.services,
      ...input.services,
    })
    shopConfigurators = normalizeShopConfigurators(
      { ...current.shopConfigurators, ...input.shopConfigurators },
      services
    )
    managedCatalog = normalizeManagedCatalog(
      current.managedCatalog,
      services,
      shopConfigurators
    )
  }

  const next: AdminSettings = {
    checkout: normalizeCheckoutRuntimeConfig(input.checkout),
    company: normalizeCompanySettings({
      ...current.company,
      ...input.company,
    }),
    launch: normalizeLaunchSettings({
      ...current.launch,
      ...input.launch,
    }),
    services,
    shopConfigurators,
    managedCatalog,
    showSupportOnMainSite:
      input.showSupportOnMainSite !== undefined
        ? normalizeSupportFlag(input.showSupportOnMainSite)
        : current.showSupportOnMainSite === true,
    showSupportOnCountdownPage:
      input.showSupportOnCountdownPage !== undefined
        ? normalizeSupportFlag(input.showSupportOnCountdownPage)
        : current.showSupportOnCountdownPage === true,
    supportMilestones:
      input.supportMilestones !== undefined
        ? normalizeSupportMilestones(input.supportMilestones)
        : normalizeSupportMilestones(current.supportMilestones),
    supportFeatures:
      input.supportFeatures !== undefined
        ? normalizeSupportFeatures(input.supportFeatures)
        : normalizeSupportFeatures(current.supportFeatures),
    enableOnboardingTour:
      input.enableOnboardingTour !== undefined
        ? normalizeEnableOnboardingTour(input.enableOnboardingTour)
        : normalizeEnableOnboardingTour(current.enableOnboardingTour),
    onboardingTourText:
      input.onboardingTourText !== undefined
        ? normalizeOnboardingTourText(input.onboardingTourText)
        : normalizeOnboardingTourText(current.onboardingTourText),
    themeInboundTourImageUrl:
      input.themeInboundTourImageUrl !== undefined
        ? normalizeThemeInboundTourImageUrl(input.themeInboundTourImageUrl)
        : normalizeThemeInboundTourImageUrl(current.themeInboundTourImageUrl),
    enableRewardPointsSystem:
      input.enableRewardPointsSystem !== undefined
        ? normalizeEnableRewardPointsSystem(input.enableRewardPointsSystem)
        : normalizeEnableRewardPointsSystem(current.enableRewardPointsSystem),
    loyaltyEarnPercent:
      input.loyaltyEarnPercent !== undefined
        ? normalizeLoyaltyEarnPercent(input.loyaltyEarnPercent)
        : normalizeLoyaltyEarnPercent(
            current.loyaltyEarnPercent ?? DEFAULT_LOYALTY_EARN_PERCENT
          ),
    loyaltyPointValueChf:
      input.loyaltyPointValueChf !== undefined
        ? normalizeLoyaltyPointValueChf(input.loyaltyPointValueChf)
        : normalizeLoyaltyPointValueChf(
            current.loyaltyPointValueChf ?? DEFAULT_LOYALTY_POINT_VALUE_CHF
          ),
    loyaltyPointsExpiryMonths:
      input.loyaltyPointsExpiryMonths !== undefined
        ? normalizeLoyaltyExpiryMonths(input.loyaltyPointsExpiryMonths)
        : normalizeLoyaltyExpiryMonths(
            current.loyaltyPointsExpiryMonths ?? DEFAULT_LOYALTY_EXPIRY_MONTHS
          ),
    showTopProductsOnHomepage:
      input.showTopProductsOnHomepage !== undefined
        ? normalizeShowTopProductsOnHomepage(input.showTopProductsOnHomepage)
        : normalizeShowTopProductsOnHomepage(current.showTopProductsOnHomepage),
    topProductsCount:
      input.topProductsCount !== undefined
        ? normalizeTopProductsCount(input.topProductsCount)
        : normalizeTopProductsCount(
            current.topProductsCount ?? DEFAULT_TOP_PRODUCTS_COUNT
          ),
    requireAdmin2fa:
      input.requireAdmin2fa !== undefined
        ? input.requireAdmin2fa !== false
        : current.requireAdmin2fa !== false,
    wishlistIcon:
      input.wishlistIcon !== undefined
        ? normalizeWishlistIcon(input.wishlistIcon)
        : normalizeWishlistIcon(current.wishlistIcon),
    wishlistIconCustomUrl:
      input.wishlistIconCustomUrl !== undefined
        ? normalizeWishlistIconCustomUrl(input.wishlistIconCustomUrl)
        : normalizeWishlistIconCustomUrl(current.wishlistIconCustomUrl),
    orderEmailTemplates:
      input.orderEmailTemplates !== undefined
        ? normalizeOrderEmailTemplates({
            ...current.orderEmailTemplates,
            ...input.orderEmailTemplates,
          })
        : normalizeOrderEmailTemplates(current.orderEmailTemplates),
    orderEmailLayout:
      input.orderEmailLayout !== undefined
        ? normalizeOrderEmailLayout({
            ...normalizeOrderEmailLayout(current.orderEmailLayout),
            ...(typeof input.orderEmailLayout === "object" &&
            input.orderEmailLayout !== null
              ? input.orderEmailLayout
              : {}),
          })
        : normalizeOrderEmailLayout(current.orderEmailLayout),
    updatedAt: new Date().toISOString(),
  }
  await withCosmosFallback(
    "saveSettings",
    async () => {
      await cosmosSaveSettings(next)
      return next
    },
    async () => {
      await writeJsonFile(SETTINGS_FILE, next)
      return next
    }
  )
  return next
}

export async function setShopLive(shopLive: boolean): Promise<AdminSettings> {
  const current = await getSettings()
  const next: AdminSettings = {
    ...current,
    launch: { ...current.launch, shopLive },
    updatedAt: new Date().toISOString(),
  }
  await withCosmosFallback(
    "setShopLive",
    async () => {
      await cosmosSaveSettings(next)
      return next
    },
    async () => {
      await writeJsonFile(SETTINGS_FILE, next)
      return next
    }
  )
  return next
}

function parseSiteConfigFile(
  stored: unknown
): SiteConfigBundle | null {
  if (!stored || typeof stored !== "object") return null
  const raw = stored as Record<string, unknown>
  if ("texts" in raw || "images" in raw || "links" in raw || "navItems" in raw || "pages" in raw || "faqItems" in raw) {
    const texts = mergeSiteTexts(
      (raw.texts as Partial<Record<string, string>> | undefined) ?? null
    )
    const lists = mergeCmsPageContentLists(raw as Parameters<typeof mergeCmsPageContentLists>[0])
    return {
      texts,
      images: mergeSiteImages(
        (raw.images as Partial<Record<string, unknown>> | undefined) ?? null
      ),
      links: mergeSiteLinks((raw.links as SiteLinks | undefined) ?? null),
      navItems: mergeCmsNavItems(raw.navItems),
      pages: mergeCmsPages(raw.pages),
      faqItems: mergeCmsFaqItems(raw.faqItems, texts),
      ...lists,
    }
  }
  // Legacy: flache Text-Map ohne images
  const texts = mergeSiteTexts(raw as Partial<Record<string, string>>)
  return {
    texts,
    images: mergeSiteImages(null),
    links: mergeSiteLinks(null),
    navItems: mergeCmsNavItems(null),
    pages: mergeCmsPages(null),
    faqItems: mergeCmsFaqItems(null, texts),
    ...getDefaultCmsPageContentLists(),
  }
}

export async function getSiteConfigProduction(): Promise<SiteConfigBundle> {
  return withCosmosFallback(
    "getSiteConfigProduction",
    cosmosGetSiteConfigProduction,
    async () => {
      const stored = await readJsonFile<unknown>(SITE_CONFIG_PRODUCTION_FILE, null)
      const parsed = parseSiteConfigFile(stored)
      if (parsed) return parsed

      const legacy = await readJsonFile<Partial<Record<string, string>> | null>(
        SITE_TEXTS_FILE,
        null
      )
      const texts = mergeSiteTexts(legacy)
      return {
        texts,
        images: mergeSiteImages(null),
        links: mergeSiteLinks(null),
        navItems: mergeCmsNavItems(null),
        pages: mergeCmsPages(null),
        faqItems: mergeCmsFaqItems(null, texts),
        ...getDefaultCmsPageContentLists(),
      }
    }
  )
}

export async function getSiteConfigStaging(): Promise<SiteConfigBundle> {
  return withCosmosFallback(
    "getSiteConfigStaging",
    cosmosGetSiteConfigStaging,
    async () => {
      const stored = await readJsonFile<unknown>(SITE_CONFIG_STAGING_FILE, null)
      const parsed = parseSiteConfigFile(stored)
      if (parsed) return parsed
      return getSiteConfigProduction()
    }
  )
}

export async function saveSiteConfigStaging(
  input: {
    texts?: SiteTexts
    images?: SiteImages
    links?: SiteLinks
    navItems?: CmsNavItem[]
    pages?: CmsPageEntry[]
    faqItems?: CmsFaqItem[]
    processSteps3d?: CmsProcessStep[]
    processStepsLaser?: CmsProcessStep[]
    expectItems3d?: CmsExpectItem[]
    expectItemsLaser?: CmsExpectItem[]
    contactFormFields?: CmsContactField[]
  }
): Promise<SiteConfigBundle> {
  const existing = await getSiteConfigStaging()
  const texts = sanitizeSiteTextsInput(input.texts ?? existing.texts)
  const lists = mergeCmsPageContentLists({
    processSteps3d: input.processSteps3d ?? existing.processSteps3d,
    processStepsLaser: input.processStepsLaser ?? existing.processStepsLaser,
    expectItems3d: input.expectItems3d ?? existing.expectItems3d,
    expectItemsLaser: input.expectItemsLaser ?? existing.expectItemsLaser,
    contactFormFields: input.contactFormFields ?? existing.contactFormFields,
  })
  const bundle: SiteConfigBundle = {
    texts,
    images: sanitizeSiteImagesInput(input.images ?? existing.images),
    links: sanitizeSiteLinksInput(input.links ?? existing.links),
    navItems: sanitizeCmsNavItemsInput(input.navItems ?? existing.navItems),
    pages: mergeCmsPages(input.pages ?? existing.pages),
    faqItems: sanitizeCmsFaqItemsInput(input.faqItems ?? existing.faqItems),
    ...lists,
  }
  return withCosmosFallback(
    "saveSiteConfigStaging",
    async () => cosmosSaveSiteConfigStaging(bundle),
    async () => {
      await writeJsonFile(SITE_CONFIG_STAGING_FILE, bundle)
      return bundle
    }
  )
}

export async function publishSiteConfig(): Promise<SiteConfigBundle> {
  return withCosmosFallback(
    "publishSiteConfig",
    async () => cosmosPublishSiteConfig(),
    async () => {
      const staging = await getSiteConfigStaging()
      const lists = mergeCmsPageContentLists(staging)
      const published: SiteConfigBundle = {
        texts: sanitizeSiteTextsInput(staging.texts),
        images: sanitizeSiteImagesInput(staging.images),
        links: sanitizeSiteLinksInput(staging.links),
        navItems: sanitizeCmsNavItemsInput(staging.navItems),
        pages: mergeCmsPages(staging.pages),
        faqItems: sanitizeCmsFaqItemsInput(staging.faqItems),
        ...lists,
      }
      await writeJsonFile(SITE_CONFIG_PRODUCTION_FILE, published)
      return published
    }
  )
}

export async function getSiteConfigMeta(): Promise<{
  stagingUpdatedAt: string | null
  productionUpdatedAt: string | null
}> {
  return withCosmosFallback(
    "getSiteConfigMeta",
    cosmosGetSiteConfigMeta,
    async () => ({ stagingUpdatedAt: null, productionUpdatedAt: null })
  )
}

export async function getSiteTexts(): Promise<SiteTexts> {
  const bundle = await getSiteConfigProduction()
  return bundle.texts
}

export async function saveSiteTexts(texts: SiteTexts): Promise<SiteTexts> {
  const saved = await saveSiteConfigStaging({ texts })
  return saved.texts
}

type MaterialStatsFileDoc = {
  types?: MaterialTypeDefinition[]
  laserTypes?: LaserMaterialTypeDefinition[]
  categories?: Partial<MaterialStatsMap>
}

function isMaterialStatsFileDoc(stored: unknown): stored is MaterialStatsFileDoc {
  return Boolean(
    stored &&
      typeof stored === "object" &&
      !Array.isArray(stored) &&
      ("types" in stored || "laserTypes" in stored)
  )
}

function filamentTypesFromFile(stored: unknown): MaterialTypeDefinition[] {
  if (!stored) return mergeMaterialTypes(null)
  if (Array.isArray(stored)) return mergeMaterialTypes(stored as MaterialTypeDefinition[])
  if (isMaterialStatsFileDoc(stored)) {
    if (Array.isArray(stored.types)) return mergeMaterialTypes(stored.types)
    return mergeMaterialTypes(stored.categories ?? null)
  }
  return mergeMaterialTypes(stored as Partial<MaterialStatsMap>)
}

function laserTypesFromFile(stored: unknown): LaserMaterialTypeDefinition[] {
  if (isMaterialStatsFileDoc(stored)) {
    return mergeLaserMaterialTypes(stored.laserTypes)
  }
  return mergeLaserMaterialTypes(null)
}

export async function getMaterialStats(): Promise<MaterialStatsMap> {
  return withCosmosFallback(
    "getMaterialStats",
    cosmosGetMaterialStats,
    async () => {
      const stored = await readJsonFile<unknown>(MATERIAL_STATS_FILE, null)
      return typesToLegacyMap(filamentTypesFromFile(stored))
    }
  )
}

export async function getMaterialTypes(): Promise<MaterialTypeDefinition[]> {
  return withCosmosFallback(
    "getMaterialTypes",
    cosmosGetMaterialTypes,
    async () => {
      const stored = await readJsonFile<unknown>(MATERIAL_STATS_FILE, null)
      return filamentTypesFromFile(stored)
    }
  )
}

export async function getLaserMaterialTypes(): Promise<LaserMaterialTypeDefinition[]> {
  return withCosmosFallback(
    "getLaserMaterialTypes",
    cosmosGetLaserMaterialTypes,
    async () => {
      const stored = await readJsonFile<unknown>(MATERIAL_STATS_FILE, null)
      return laserTypesFromFile(stored)
    }
  )
}

export async function saveMaterialTypes(
  types: MaterialTypeDefinition[]
): Promise<MaterialTypeDefinition[]> {
  return withCosmosRequired("saveMaterialTypes", () => cosmosSaveMaterialTypes(types))
}

export async function saveLaserMaterialTypes(
  laserTypes: LaserMaterialTypeDefinition[]
): Promise<LaserMaterialTypeDefinition[]> {
  return withCosmosRequired("saveLaserMaterialTypes", () =>
    cosmosSaveLaserMaterialTypes(laserTypes)
  )
}

export async function saveMaterialStats(
  categories: MaterialStatsMap
): Promise<MaterialStatsMap> {
  return withCosmosRequired("saveMaterialStats", () =>
    cosmosSaveMaterialStats(categories)
  )
}

export async function getAiSettings(): Promise<AiSettingsDocument> {
  return withCosmosFallback(
    "getAiSettings",
    cosmosGetAiSettings,
    async () => {
      const stored = await readJsonFile<Partial<AiSettingsDocument> | null>(
        AI_SETTINGS_FILE,
        null
      )
      return mergeAiSettings(stored)
    }
  )
}

export async function saveAiSettings(
  settings: AiSettingsDocument
): Promise<AiSettingsDocument> {
  return withCosmosRequired("saveAiSettings", () => cosmosSaveAiSettings(settings))
}

export async function getDocumentTemplateSettings(): Promise<DocumentTemplateSettings> {
  const company = (await getSettings()).company
  return withCosmosFallback(
    "getDocumentTemplateSettings",
    () => cosmosGetDocumentTemplateSettings(company),
    async () => {
      const stored = await readJsonFile<Partial<DocumentTemplateSettings> | null>(
        DOCUMENT_TEMPLATE_FILE,
        null
      )
      if (stored) return mergeDocumentTemplateSettings(stored, company)

      const legacyStored = await readJsonFile<Partial<DocumentTemplateSettings> | null>(
        LEGACY_INVOICE_TEMPLATE_FILE,
        null
      )
      return mergeDocumentTemplateSettings(legacyStored, company)
    }
  )
}

export async function saveDocumentTemplateSettings(
  settings: DocumentTemplateSettings
): Promise<DocumentTemplateSettings> {
  const saved = await withCosmosRequired("saveDocumentTemplateSettings", () =>
    cosmosSaveDocumentTemplateSettings(settings)
  )

  const current = await getSettings()
  await saveSettings({
    ...current,
    company: {
      firmenname: saved.firmenname,
      firmenAdresse: saved.firmenAdresse,
      iban: saved.iban,
      bankname: saved.bankname,
      kontaktEmail: saved.kontaktEmail,
      telefonnummer: current.company.telefonnummer ?? "",
    },
  })

  return saved
}

export const getInvoiceTemplateSettings = getDocumentTemplateSettings
export const saveInvoiceTemplateSettings = saveDocumentTemplateSettings

export async function getPrintCalculatorSettings(): Promise<PrintCalculatorSettings> {
  return withCosmosFallback(
    "getPrintCalculatorSettings",
    cosmosGetPrintCalculatorSettings,
    async () => {
      const stored = await readJsonFile<Partial<PrintCalculatorSettings> | null>(
        PRINT_CALCULATOR_FILE,
        null
      )
      return mergePrintCalculatorSettings(stored)
    }
  )
}

export async function savePrintCalculatorSettings(
  settings: PrintCalculatorSettings
): Promise<PrintCalculatorSettings> {
  return withCosmosRequired("savePrintCalculatorSettings", () =>
    cosmosSavePrintCalculatorSettings(settings)
  )
}

export async function getLaserConfiguratorSettings(): Promise<LaserConfiguratorSettings> {
  return withCosmosFallback(
    "getLaserConfiguratorSettings",
    cosmosGetLaserConfiguratorSettings,
    async () => {
      const stored = await readJsonFile<Partial<LaserConfiguratorSettings> | null>(
        LASER_CONFIGURATOR_FILE,
        null
      )
      return mergeLaserConfiguratorSettings(stored)
    }
  )
}

export async function saveLaserConfiguratorSettings(
  settings: LaserConfiguratorSettings
): Promise<LaserConfiguratorSettings> {
  return withCosmosRequired("saveLaserConfiguratorSettings", () =>
    cosmosSaveLaserConfiguratorSettings(settings)
  )
}

export async function getFilamentMaterials(): Promise<FilamentMaterial[]> {
  return withCosmosFallback(
    "getFilamentMaterials",
    cosmosGetFilamentMaterials,
    async () => {
      const [types, inventoryItems, storedFilaments] = await Promise.all([
        getMaterialTypes(),
        getMaterials("filament"),
        readJsonFile<AdminFilament[] | null>(FILAMENTS_FILE, null),
      ])
      const { resolveFilamentMaterialsFromSources } = await import(
        "@/lib/dripforge/filament-catalog"
      )
      return resolveFilamentMaterialsFromSources(
        inventoryItems,
        storedFilaments ?? [],
        types
      )
    }
  )
}
