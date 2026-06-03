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
import type {
  AdminProduct,
  AdminSettings,
  CompanySettings,
  LaunchSettings,
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
  isCosmosConfigured,
  cosmosGetCustomers,
  cosmosGetCustomerByNumber,
  cosmosGetOrderById,
  cosmosGetOrders,
  cosmosGetProducts,
  cosmosGetSettings,
  cosmosSaveOrder,
  cosmosSaveProducts,
  cosmosSaveSettings,
  cosmosUpdateOrderInvoice,
  cosmosUpdateOrderStatus,
  cosmosUpsertCustomerFromOrder,
} from "@/lib/admin/cosmos-store"

const DATA_DIR = path.join(process.cwd(), "data", "admin")

const ORDERS_FILE = "orders.json"
const PRODUCTS_FILE = "products.json"
const SETTINGS_FILE = "settings.json"
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

export async function getOrders(): Promise<StoredOrder[]> {
  if (isCosmosConfigured()) return cosmosGetOrders()
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  return orders.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function getOrderById(orderId: string): Promise<StoredOrder | null> {
  if (isCosmosConfigured()) return cosmosGetOrderById(orderId)
  const orders = await getOrders()
  return orders.find((o) => o.orderId === orderId) ?? null
}

export async function saveOrder(order: StoredOrder): Promise<void> {
  if (isCosmosConfigured()) {
    await cosmosSaveOrder(order)
    return
  }
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  orders.unshift(order)
  await writeJsonFile(ORDERS_FILE, orders)
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

export async function upsertCustomerFromOrder(
  order: StoredOrder
): Promise<StoredCustomer> {
  if (isCosmosConfigured()) return cosmosUpsertCustomerFromOrder(order)
  const customers = await readJsonFile<StoredCustomer[]>(CUSTOMERS_FILE, [])
  const email = normalizeCustomerEmail(order.billing.email)
  const index = customers.findIndex((c) => c.email === email)

  let customer: StoredCustomer

  if (index >= 0) {
    customer = mergeOrderIntoCustomer(customers[index], order)
    customers[index] = customer
  } else {
    const kundennummer = generateCustomerNumber(customers)
    customer = buildCustomerFromOrder(order, kundennummer)
    customers.push(customer)
  }

  await writeJsonFile(CUSTOMERS_FILE, customers)
  await attachCustomerToOrder(order.orderId, customer.kundennummer)
  return customer
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
      const kundennummer = generateCustomerNumber([...byEmail.values()])
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

export async function getCustomers(): Promise<StoredCustomer[]> {
  if (isCosmosConfigured()) return cosmosGetCustomers()
  await reconcileCustomersFromOrders()
  const customers = await readJsonFile<StoredCustomer[]>(CUSTOMERS_FILE, [])
  return customers.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export async function getCustomerByNumber(
  kundennummer: string
): Promise<StoredCustomer | null> {
  if (isCosmosConfigured()) return cosmosGetCustomerByNumber(kundennummer)
  await reconcileCustomersFromOrders()
  const customers = await readJsonFile<StoredCustomer[]>(CUSTOMERS_FILE, [])
  return customers.find((c) => c.kundennummer === kundennummer) ?? null
}

export async function updateOrderStatus(
  orderId: string,
  status: StoredOrder["status"]
): Promise<StoredOrder | null> {
  if (isCosmosConfigured()) return cosmosUpdateOrderStatus(orderId, status)
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  const index = orders.findIndex((o) => o.orderId === orderId)
  if (index === -1) return null
  orders[index] = { ...orders[index], status }
  await writeJsonFile(ORDERS_FILE, orders)
  return orders[index]
}

export async function updateOrderInvoice(
  orderId: string,
  data: Pick<StoredOrder, "rechnungPdfUrl" | "rechnungPdfPath" | "kundennummer">
): Promise<StoredOrder | null> {
  if (isCosmosConfigured()) return cosmosUpdateOrderInvoice(orderId, data)
  const orders = await readJsonFile<StoredOrder[]>(ORDERS_FILE, [])
  const index = orders.findIndex((o) => o.orderId === orderId)
  if (index === -1) return null
  orders[index] = { ...orders[index], ...data }
  await writeJsonFile(ORDERS_FILE, orders)
  return orders[index]
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

export async function getProducts(): Promise<AdminProduct[]> {
  if (isCosmosConfigured()) return cosmosGetProducts()
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

export async function saveProducts(products: AdminProduct[]): Promise<void> {
  if (isCosmosConfigured()) {
    await cosmosSaveProducts(products)
    return
  }
  await writeJsonFile(PRODUCTS_FILE, products)
}

export async function getProductById(id: string): Promise<AdminProduct | null> {
  const products = await getProducts()
  return products.find((p) => p.id === id) ?? null
}

export async function upsertProduct(product: AdminProduct): Promise<AdminProduct> {
  const products = await getProducts()
  const next: AdminProduct = {
    ...product,
    updatedAt: new Date().toISOString(),
  }
  const index = products.findIndex((p) => p.id === product.id)
  if (index >= 0) {
    products[index] = next
  } else {
    products.push(next)
  }
  await saveProducts(products)
  return next
}

export async function deleteProduct(id: string): Promise<boolean> {
  const products = await getProducts()
  const filtered = products.filter((p) => p.id !== id)
  if (filtered.length === products.length) return false
  await saveProducts(filtered)
  return true
}

export async function getSettings(): Promise<AdminSettings> {
  if (isCosmosConfigured()) return cosmosGetSettings()
  const stored = await readJsonFile<AdminSettings | null>(SETTINGS_FILE, null)
  if (stored?.checkout) {
    return {
      checkout: stored.checkout,
      company: { ...DEFAULT_COMPANY, ...stored.company },
      launch: { ...DEFAULT_LAUNCH_SETTINGS, ...stored.launch },
      services: normalizeServiceVisibility(stored.services),
      updatedAt: stored.updatedAt,
    }
  }
  const defaults: AdminSettings = {
    checkout: { ...DEFAULT_CHECKOUT_RUNTIME_CONFIG },
    company: { ...DEFAULT_COMPANY },
    launch: { ...DEFAULT_LAUNCH_SETTINGS },
    services: { ...DEFAULT_SERVICE_VISIBILITY },
    updatedAt: new Date().toISOString(),
  }
  await writeJsonFile(SETTINGS_FILE, defaults)
  return defaults
}

export async function saveSettings(input: {
  checkout: AdminSettings["checkout"]
  company?: CompanySettings
  launch?: Partial<LaunchSettings>
  services?: Partial<AdminSettings["services"]>
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
    updatedAt: new Date().toISOString(),
  }
  if (isCosmosConfigured()) {
    await cosmosSaveSettings(next)
    return next
  }
  await writeJsonFile(SETTINGS_FILE, next)
  return next
}

export async function setShopLive(shopLive: boolean): Promise<AdminSettings> {
  const current = await getSettings()
  const next: AdminSettings = {
    ...current,
    launch: { ...current.launch, shopLive },
    updatedAt: new Date().toISOString(),
  }
  if (isCosmosConfigured()) {
    await cosmosSaveSettings(next)
    return next
  }
  await writeJsonFile(SETTINGS_FILE, next)
  return next
}
