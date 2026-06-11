import { promises as fs } from "fs"
import path from "path"
import { products as seedProducts } from "@/lib/dripforge/data"
import { DEFAULT_CHECKOUT_RUNTIME_CONFIG } from "@/lib/dripforge/checkout-config"
import {
  buildCustomerFromOrder,
  generateCustomerNumber,
  mergeOrderIntoCustomer,
  normalizeCustomerEmail,
} from "@/lib/admin/customers"
import { reconcilePortalAccounts } from "@/lib/konto/crm-sync"
import { listAllAccounts } from "@/lib/konto/account-db"
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
import { normalizeServiceVisibility } from "@/lib/dripforge/service-visibility"
import {
  buildDefaultAdminSettings,
  normalizeSupportPageActive,
} from "@/lib/admin/safe-defaults"
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
  cosmosUpdateOrderStatus,
  cosmosUpsertCustomerFromOrder,
} from "@/lib/admin/cosmos-store"
import {
  cosmosGetSiteTexts,
  cosmosSaveSiteTexts,
} from "@/lib/admin/cosmos-site-texts"
import {
  cosmosDeleteFilament,
  cosmosGetFilamentById,
  cosmosGetFilamentMaterials,
  cosmosGetFilaments,
  cosmosUpsertFilament,
} from "@/lib/admin/cosmos-filaments"
import {
  cosmosGetMaterialStats,
  cosmosSaveMaterialStats,
} from "@/lib/admin/cosmos-material-stats"
import { mergeSiteTexts, type SiteTexts } from "@/lib/admin/site-texts"
import type { AdminFilament } from "@/lib/admin/filament-types"
import {
  mergeMaterialStats,
  type MaterialStatsMap,
} from "@/lib/admin/material-stats-types"
import {
  groupFilamentsForConfigurator,
  legacyMaterialsFallback,
  seedFilamentsFromLegacyMaterials,
} from "@/lib/dripforge/filament-catalog"
import type { FilamentMaterial } from "@/lib/dripforge/types"

const DATA_DIR = path.join(process.cwd(), "data", "admin")

const ORDERS_FILE = "orders.json"
const PRODUCTS_FILE = "products.json"
const SETTINGS_FILE = "settings.json"
const SITE_TEXTS_FILE = "site-texts.json"
const FILAMENTS_FILE = "filaments.json"
const MATERIAL_STATS_FILE = "material-stats.json"
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
    const accounts = await listAllAccounts()
    const kundennummer = generateCustomerNumber([
      ...customers,
      ...accounts
        .filter((a) => a.kundennummer)
        .map((a) => ({ kundennummer: a.kundennummer! })),
    ])
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
      const accounts = await listAllAccounts()
      const kundennummer = generateCustomerNumber([
        ...byEmail.values(),
        ...accounts
          .filter((a) => a.kundennummer)
          .map((a) => ({ kundennummer: a.kundennummer! })),
      ])
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
    return {
      checkout: stored.checkout,
      company: { ...DEFAULT_COMPANY, ...stored.company },
      launch: { ...DEFAULT_LAUNCH_SETTINGS, ...stored.launch },
      services: normalizeServiceVisibility(stored.services),
      isSupportPageActive: stored.isSupportPageActive === true,
      updatedAt: stored.updatedAt,
    }
  }
  const defaults: AdminSettings = {
    checkout: { ...DEFAULT_CHECKOUT_RUNTIME_CONFIG },
    company: { ...DEFAULT_COMPANY },
    launch: { ...DEFAULT_LAUNCH_SETTINGS },
    services: { ...DEFAULT_SERVICE_VISIBILITY },
    isSupportPageActive: false,
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
  isSupportPageActive?: boolean
}): Promise<AdminSettings> {
  const current = await getSettings()
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
    services: normalizeServiceVisibility({
      ...current.services,
      ...input.services,
    }),
    isSupportPageActive:
      input.isSupportPageActive !== undefined
        ? normalizeSupportPageActive(input.isSupportPageActive)
        : current.isSupportPageActive === true,
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

export async function getSiteTexts(): Promise<SiteTexts> {
  return withCosmosFallback(
    "getSiteTexts",
    cosmosGetSiteTexts,
    async () => {
      const stored = await readJsonFile<Partial<Record<string, string>> | null>(
        SITE_TEXTS_FILE,
        null
      )
      return mergeSiteTexts(stored)
    }
  )
}

export async function saveSiteTexts(texts: SiteTexts): Promise<SiteTexts> {
  return withCosmosRequired("saveSiteTexts", () => cosmosSaveSiteTexts(texts))
}

export async function getMaterialStats(): Promise<MaterialStatsMap> {
  return withCosmosFallback(
    "getMaterialStats",
    cosmosGetMaterialStats,
    async () => {
      const stored = await readJsonFile<Partial<MaterialStatsMap> | null>(
        MATERIAL_STATS_FILE,
        null
      )
      return mergeMaterialStats(stored)
    }
  )
}

export async function saveMaterialStats(
  categories: MaterialStatsMap
): Promise<MaterialStatsMap> {
  return withCosmosRequired("saveMaterialStats", () =>
    cosmosSaveMaterialStats(categories)
  )
}

export async function getAdminFilaments(): Promise<AdminFilament[]> {
  return withCosmosRequired("getAdminFilaments", cosmosGetFilaments)
}

export async function getFilamentMaterials(): Promise<FilamentMaterial[]> {
  return withCosmosFallback(
    "getFilamentMaterials",
    cosmosGetFilamentMaterials,
    async () => {
      const [stored, stats] = await Promise.all([
        readJsonFile<AdminFilament[] | null>(FILAMENTS_FILE, null),
        getMaterialStats(),
      ])
      if (stored?.length) return groupFilamentsForConfigurator(stored, stats)
      return legacyMaterialsFallback(stats)
    }
  )
}

export async function getFilamentsForStorefront(): Promise<AdminFilament[]> {
  return withCosmosFallback(
    "getFilamentsForStorefront",
    cosmosGetFilaments,
    async () => {
      const stored = await readJsonFile<AdminFilament[] | null>(FILAMENTS_FILE, null)
      if (stored?.length) return stored
      return seedFilamentsFromLegacyMaterials()
    }
  )
}

export async function getAdminFilamentById(id: string): Promise<AdminFilament | null> {
  return withCosmosRequired("getAdminFilamentById", () => cosmosGetFilamentById(id))
}

export async function upsertFilament(filament: AdminFilament): Promise<AdminFilament> {
  return withCosmosRequired("upsertFilament", () => cosmosUpsertFilament(filament))
}

export async function deleteFilament(id: string): Promise<boolean> {
  return withCosmosRequired("deleteFilament", () => cosmosDeleteFilament(id))
}
