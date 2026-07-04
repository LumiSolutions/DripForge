import { promises as fs } from "fs"
import path from "path"
import { products as seedProducts } from "@/lib/dripforge/data"
import { DEFAULT_CHECKOUT_RUNTIME_CONFIG } from "@/lib/dripforge/checkout-config"
import {
  buildCustomerFromOrder,
  mergeOrderIntoCustomer,
  normalizeCustomerEmail,
} from "@/lib/admin/customers"
import { allocateNextCustomerNumber } from "@/lib/admin/customer-number-service"
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
import { DEFAULT_COMPANY_SETTINGS as DEFAULT_COMPANY } from "@/lib/admin/types"
import {
  DEFAULT_LAUNCH_SETTINGS,
  DEFAULT_SERVICE_VISIBILITY,
} from "@/lib/admin/types"
import { normalizeShopConfigurators } from "@/lib/dripforge/shop-configurators"
import { normalizeServiceVisibility } from "@/lib/dripforge/service-visibility"
import {
  buildDefaultAdminSettings,
  normalizeSupportFlag,
} from "@/lib/admin/safe-defaults"
import { buildSupportPageSettings } from "@/lib/dripforge/support-page-settings"
import {
  normalizeEnableOnboardingTour,
  normalizeOnboardingTourText,
  normalizeThemeInboundTourImageUrl,
  DEFAULT_ONBOARDING_TOUR_TEXT,
} from "@/lib/dripforge/theme-inbound-tour-settings"
import { normalizeEnableRewardPointsSystem } from "@/lib/dripforge/reward-points-settings"
import {
  withCosmosFallback,
  withCosmosRequired,
} from "@/lib/admin/storage-bridge"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  cosmosGetCustomers,
  cosmosGetCustomerByNumber,
  cosmosGetOrderById,
  cosmosGetOrders,
  cosmosDeleteProduct,
  cosmosGetProductById,
  cosmosGetProducts,
  cosmosGetSettings,
  cosmosSaveOrder,
  cosmosSaveSettings,
  cosmosUpsertProduct,
  cosmosUpdateOrderInvoice,
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
} from "@/lib/admin/cosmos-site-config"
import {
  cosmosGetSiteTexts,
  cosmosSaveSiteTexts,
} from "@/lib/admin/cosmos-site-texts"
import {
  cosmosGetFilamentMaterials,
} from "@/lib/admin/cosmos-filaments"
import {
  cosmosGetMaterialStats,
  cosmosGetMaterialTypes,
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
import type { AdminFilament } from "@/lib/admin/filament-types"
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
const CUSTOMERS_FILE = "customers.json"

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
  await withCosmosFallback(
    "saveOrder",
    async () => {
      await cosmosSaveOrder(order)
    },
    () => saveOrderToFile(order)
  )
}

async function attachCustomerToOrder(
  orderId: string,
  kundennummer: string
): Promise<void> {
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  const index = orders.findIndex((o) => o.orderId === orderId)
  if (index === -1) return
  if (orders[index].kundennummer === kundennummer) return
  orders[index] = { ...orders[index], kundennummer }
  await writeJsonFile(ORDERS_FILE, orders)
}

async function upsertCustomerFromOrderFile(
  order: StoredOrder
): Promise<StoredCustomer> {
  const customers = await readJsonFile<StoredCustomer[]>(CUSTOMERS_FILE, [])
  const email = normalizeCustomerEmail(order.billing.email)
  const index = customers.findIndex((c) => c.email === email)

  let customer: StoredCustomer

  if (index >= 0) {
    customer = mergeOrderIntoCustomer(customers[index], order)
    customers[index] = customer
  } else {
    const kundennummer = await allocateNextCustomerNumber()
    customer = buildCustomerFromOrder(order, kundennummer)
    customers.push(customer)
  }

  await writeJsonFile(CUSTOMERS_FILE, customers)
  await attachCustomerToOrder(order.orderId, customer.kundennummer)
  return customer
}

export async function upsertCustomerFromOrder(
  order: StoredOrder
): Promise<StoredCustomer> {
  return withCosmosFallback(
    "upsertCustomerFromOrder",
    () => cosmosUpsertCustomerFromOrder(order),
    () => upsertCustomerFromOrderFile(order)
  )
}

export async function reconcileCustomersFromOrders(): Promise<void> {
  const customers = await readJsonFile<StoredCustomer[]>(CUSTOMERS_FILE, [])
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  const byEmail = new Map(customers.map((c) => [c.email, c]))
  let changed = false

  for (const order of orders) {
    const email = normalizeCustomerEmail(order.billing.email)
    const existing = byEmail.get(email)

    if (existing) {
      const merged = mergeOrderIntoCustomer(existing, order)
      if (
        merged.orderIds.length !== existing.orderIds.length ||
        merged.updatedAt !== existing.updatedAt
      ) {
        byEmail.set(email, merged)
        changed = true
      }
      if (order.kundennummer !== merged.kundennummer) {
        await attachCustomerToOrder(order.orderId, merged.kundennummer)
      }
    } else {
      const kundennummer = await allocateNextCustomerNumber()
      const created = buildCustomerFromOrder(order, kundennummer)
      byEmail.set(email, created)
      changed = true
      await attachCustomerToOrder(order.orderId, kundennummer)
    }
  }

  if (changed) {
    await writeJsonFile(CUSTOMERS_FILE, [...byEmail.values()])
  }
}

async function getCustomersFromFile(): Promise<StoredCustomer[]> {
  await reconcileCustomersFromOrders()
  const customers = await readJsonFile<StoredCustomer[]>(CUSTOMERS_FILE, [])
  return customers.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export async function getCustomers(): Promise<StoredCustomer[]> {
  try {
    await reconcilePortalAccounts()
    return await withCosmosFallback("getCustomers", cosmosGetCustomers, getCustomersFromFile)
  } catch (error) {
    logCosmosError("getCustomers:total-failure", error)
    return []
  }
}

export async function getCustomerByNumber(
  kundennummer: string
): Promise<StoredCustomer | null> {
  return withCosmosFallback(
    "getCustomerByNumber",
    () => cosmosGetCustomerByNumber(kundennummer),
    async () => {
      await reconcileCustomersFromOrders()
      const customers = await readJsonFile<StoredCustomer[]>(CUSTOMERS_FILE, [])
      return customers.find((c) => c.kundennummer === kundennummer) ?? null
    }
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
  data: Pick<StoredOrder, "rechnungPdfUrl" | "rechnungPdfPath" | "kundennummer">
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
  data: Pick<StoredOrder, "rechnungPdfUrl" | "rechnungPdfPath" | "kundennummer">
): Promise<StoredOrder | null> {
  return withCosmosFallback(
    "updateOrderInvoice",
    () => cosmosUpdateOrderInvoice(orderId, data),
    () => updateOrderInvoiceInFile(orderId, data)
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
  if (stored && stored.length > 0) return stored
  const seeded = seedProducts.map((p) => ({
    ...p,
    istAktiv: p.istAktiv !== false,
    galerieBilder: p.galerieBilder ?? p.images ?? [],
    modellDateiUrl: p.modellDateiUrl ?? p.modelUrl,
    updatedAt: new Date().toISOString(),
  }))
  await writeJsonFile(PRODUCTS_FILE, seeded)
  return seeded
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
    return {
      checkout: stored.checkout,
      company: { ...DEFAULT_COMPANY, ...stored.company },
      launch: { ...DEFAULT_LAUNCH_SETTINGS, ...stored.launch },
      services,
      shopConfigurators: normalizeShopConfigurators(
        stored.shopConfigurators,
        services
      ),
      ...buildSupportPageSettings(stored),
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
      updatedAt: stored.updatedAt,
    }
  }
  const defaults: AdminSettings = {
    checkout: { ...DEFAULT_CHECKOUT_RUNTIME_CONFIG },
    company: { ...DEFAULT_COMPANY },
    launch: { ...DEFAULT_LAUNCH_SETTINGS },
    services: { ...DEFAULT_SERVICE_VISIBILITY },
    shopConfigurators: normalizeShopConfigurators(null, DEFAULT_SERVICE_VISIBILITY),
    showSupportOnMainSite: false,
    showSupportOnCountdownPage: false,
    enableOnboardingTour: true,
    onboardingTourText: DEFAULT_ONBOARDING_TOUR_TEXT,
    themeInboundTourImageUrl: null,
    enableRewardPointsSystem: true,
    updatedAt: new Date().toISOString(),
  }
  try {
    await writeJsonFile(SETTINGS_FILE, defaults)
  } catch (error) {
    console.warn(
      "Dateispeicher: settings.json konnte nicht angelegt werden — Defaults werden nur im Speicher verwendet.",
      error
    )
  }
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
  showSupportOnMainSite?: boolean
  showSupportOnCountdownPage?: boolean
  enableOnboardingTour?: boolean
  onboardingTourText?: string | null
  themeInboundTourImageUrl?: string | null
  enableRewardPointsSystem?: boolean
}): Promise<AdminSettings> {
  const current = await getSettings()
  const services = normalizeServiceVisibility({
    ...current.services,
    ...input.services,
  })
  const next: AdminSettings = {
    checkout: input.checkout,
    company: {
      ...current.company,
      ...input.company,
    },
    launch: {
      ...current.launch,
      ...input.launch,
    },
    services,
    shopConfigurators: normalizeShopConfigurators(
      { ...current.shopConfigurators, ...input.shopConfigurators },
      services
    ),
    showSupportOnMainSite:
      input.showSupportOnMainSite !== undefined
        ? normalizeSupportFlag(input.showSupportOnMainSite)
        : current.showSupportOnMainSite === true,
    showSupportOnCountdownPage:
      input.showSupportOnCountdownPage !== undefined
        ? normalizeSupportFlag(input.showSupportOnCountdownPage)
        : current.showSupportOnCountdownPage === true,
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

export async function getSiteConfigProduction(): Promise<SiteTexts> {
  return withCosmosFallback(
    "getSiteConfigProduction",
    cosmosGetSiteConfigProduction,
    async () => {
      const stored = await readJsonFile<Partial<Record<string, string>> | null>(
        SITE_CONFIG_PRODUCTION_FILE,
        null
      )
      if (stored) return mergeSiteTexts(stored)

      const legacy = await readJsonFile<Partial<Record<string, string>> | null>(
        SITE_TEXTS_FILE,
        null
      )
      return mergeSiteTexts(legacy)
    }
  )
}

export async function getSiteConfigStaging(): Promise<SiteTexts> {
  return withCosmosFallback(
    "getSiteConfigStaging",
    cosmosGetSiteConfigStaging,
    async () => {
      const stored = await readJsonFile<Partial<Record<string, string>> | null>(
        SITE_CONFIG_STAGING_FILE,
        null
      )
      if (stored) return mergeSiteTexts(stored)
      return getSiteConfigProduction()
    }
  )
}

export async function saveSiteConfigStaging(texts: SiteTexts): Promise<SiteTexts> {
  const sanitized = sanitizeSiteTextsInput(texts)
  return withCosmosFallback(
    "saveSiteConfigStaging",
    async () => {
      await cosmosSaveSiteConfigStaging(sanitized)
      return sanitized
    },
    async () => {
      await writeJsonFile(SITE_CONFIG_STAGING_FILE, sanitized)
      return sanitized
    }
  )
}

export async function publishSiteConfig(): Promise<SiteTexts> {
  return withCosmosFallback(
    "publishSiteConfig",
    async () => cosmosPublishSiteConfig(),
    async () => {
      const staging = await getSiteConfigStaging()
      const published = sanitizeSiteTextsInput(staging)
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
  return getSiteConfigProduction()
}

export async function saveSiteTexts(texts: SiteTexts): Promise<SiteTexts> {
  return saveSiteConfigStaging(texts)
}

export async function getMaterialStats(): Promise<MaterialStatsMap> {
  return withCosmosFallback(
    "getMaterialStats",
    cosmosGetMaterialStats,
    async () => {
      const stored = await readJsonFile<
        | Partial<MaterialStatsMap>
        | MaterialTypeDefinition[]
        | null
      >(MATERIAL_STATS_FILE, null)
      if (Array.isArray(stored)) return typesToLegacyMap(mergeMaterialTypes(stored))
      return mergeMaterialStats(stored)
    }
  )
}

export async function getMaterialTypes(): Promise<MaterialTypeDefinition[]> {
  return withCosmosFallback(
    "getMaterialTypes",
    cosmosGetMaterialTypes,
    async () => {
      const stored = await readJsonFile<
        | Partial<MaterialStatsMap>
        | MaterialTypeDefinition[]
        | null
      >(MATERIAL_STATS_FILE, null)
      return mergeMaterialTypes(stored)
    }
  )
}

export async function saveMaterialTypes(
  types: MaterialTypeDefinition[]
): Promise<MaterialTypeDefinition[]> {
  return withCosmosRequired("saveMaterialTypes", () => cosmosSaveMaterialTypes(types))
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
