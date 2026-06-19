import {
  getCustomersContainer,
  getOrdersContainer,
  getSettingsContainer,
  isCosmosConfigured,
} from "@/lib/cosmos/client"
import {
  PRODUCT_DOC_TYPE,
  productsQuerySql,
  resolveProductsContainer,
  toProductCosmosDoc,
} from "@/lib/cosmos/products-container"
import { logCosmosError } from "@/lib/cosmos/log-error"
import { products as seedProducts } from "@/lib/dripforge/data"
import { DEFAULT_CHECKOUT_RUNTIME_CONFIG } from "@/lib/dripforge/checkout-config"
import { buildSupportPageSettings } from "@/lib/dripforge/support-page-settings"
import {
  buildCustomerFromOrder,
  generateCustomerNumber,
  mergeOrderIntoCustomer,
  normalizeCustomerEmail,
} from "@/lib/admin/customers"
import { listAllAccounts } from "@/lib/konto/account-db"
import type {
  AdminProduct,
  AdminSettings,
  StoredCustomer,
  StoredOrder,
} from "@/lib/admin/types"
import { DEFAULT_COMPANY_SETTINGS as DEFAULT_COMPANY } from "@/lib/admin/types"
import { DEFAULT_LAUNCH_SETTINGS, DEFAULT_SERVICE_VISIBILITY } from "@/lib/admin/types"
import { normalizeServiceVisibility } from "@/lib/dripforge/service-visibility"
import { normalizeShopConfigurators } from "@/lib/dripforge/shop-configurators"

export { isCosmosConfigured }

const SETTINGS_DOC_ID = "global"

type CosmosDoc<T> = T & { id: string }

function stripCosmosId<T extends { id?: string }>(doc: T): Omit<T, "id"> {
  const { id: _id, ...rest } = doc
  return rest
}

export async function cosmosSaveOrder(order: StoredOrder): Promise<void> {
  const container = await getOrdersContainer()
  await container.items.upsert({ ...order, id: order.orderId })
}

export async function cosmosGetOrders(): Promise<StoredOrder[]> {
  const container = await getOrdersContainer()
  const { resources } = await container.items
    .query<CosmosDoc<StoredOrder>>("SELECT * FROM c ORDER BY c.createdAt DESC")
    .fetchAll()
  return resources.map((doc) => stripCosmosId(doc) as StoredOrder)
}

export async function cosmosGetOrderById(
  orderId: string
): Promise<StoredOrder | null> {
  const container = await getOrdersContainer()
  try {
    const { resource } = await container
      .item(orderId, orderId)
      .read<CosmosDoc<StoredOrder>>()
    if (!resource) return null
    return stripCosmosId(resource) as StoredOrder
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetOrderById:${orderId}`, error)
    throw error
  }
}

export async function cosmosUpdateOrderStatus(
  orderId: string,
  status: StoredOrder["status"]
): Promise<StoredOrder | null> {
  const order = await cosmosGetOrderById(orderId)
  if (!order) return null
  const next = { ...order, status }
  await cosmosSaveOrder(next)
  return next
}

export async function cosmosUpdateOrderProductionStatus(
  orderId: string,
  productionStatus: StoredOrder["productionStatus"]
): Promise<StoredOrder | null> {
  const order = await cosmosGetOrderById(orderId)
  if (!order || !productionStatus) return null
  const next = { ...order, productionStatus }
  await cosmosSaveOrder(next)
  return next
}

export async function cosmosUpdateOrderInvoice(
  orderId: string,
  data: Pick<StoredOrder, "rechnungPdfUrl" | "rechnungPdfPath" | "kundennummer">
): Promise<StoredOrder | null> {
  const order = await cosmosGetOrderById(orderId)
  if (!order) return null
  const next = { ...order, ...data }
  await cosmosSaveOrder(next)
  return next
}

export async function cosmosGetCustomers(): Promise<StoredCustomer[]> {
  const container = await getCustomersContainer()
    const { resources } = await container.items
    .query<CosmosDoc<StoredCustomer>>("SELECT * FROM c ORDER BY c.updatedAt DESC")
    .fetchAll()
  return resources.map((doc) => stripCosmosId(doc) as StoredCustomer)
}

export async function cosmosGetCustomerByNumber(
  kundennummer: string
): Promise<StoredCustomer | null> {
  const container = await getCustomersContainer()
  try {
    const { resource } = await container
      .item(kundennummer, kundennummer)
      .read<CosmosDoc<StoredCustomer>>()
    if (!resource) return null
    return stripCosmosId(resource) as StoredCustomer
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    console.error("Cosmos: Kunde konnte nicht gelesen werden.", kundennummer, error)
    throw error
  }
}

export async function cosmosUpsertCustomerFromOrder(
  order: StoredOrder
): Promise<StoredCustomer> {
  const container = await getCustomersContainer()
  const email = normalizeCustomerEmail(order.billing.email)
  const customers = await cosmosGetCustomers()
  const index = customers.findIndex((c) => c.email === email)

  let customer: StoredCustomer

  if (index >= 0) {
    customer = mergeOrderIntoCustomer(customers[index], order)
  } else {
    const accounts = await listAllAccounts()
    customer = buildCustomerFromOrder(
      order,
      generateCustomerNumber([
        ...customers,
        ...accounts
          .filter((a) => a.kundennummer)
          .map((a) => ({ kundennummer: a.kundennummer! })),
      ])
    )
  }

  await container.items.upsert({ ...customer, id: customer.kundennummer })

  const orderWithCustomer = await cosmosGetOrderById(order.orderId)
  if (orderWithCustomer && orderWithCustomer.kundennummer !== customer.kundennummer) {
    await cosmosSaveOrder({ ...orderWithCustomer, kundennummer: customer.kundennummer })
  }

  return customer
}

export async function cosmosSaveCustomer(
  customer: StoredCustomer
): Promise<StoredCustomer> {
  const container = await getCustomersContainer()
  await container.items.upsert({ ...customer, id: customer.kundennummer })
  return customer
}

export async function cosmosGetSettings(): Promise<AdminSettings> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(SETTINGS_DOC_ID, SETTINGS_DOC_ID)
      .read<AdminSettings & { id: string }>()
    if (resource?.checkout) {
      const services = normalizeServiceVisibility(resource.services)
      return {
        checkout: resource.checkout,
        company: { ...DEFAULT_COMPANY, ...resource.company },
        launch: { ...DEFAULT_LAUNCH_SETTINGS, ...resource.launch },
        services,
        shopConfigurators: normalizeShopConfigurators(
          resource.shopConfigurators,
          services
        ),
        ...buildSupportPageSettings(resource),
        updatedAt: resource.updatedAt,
      }
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      console.error("Cosmos: Einstellungen konnten nicht gelesen werden.", error)
      throw error
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
    updatedAt: new Date().toISOString(),
  }
  try {
    await cosmosSaveSettings(defaults)
  } catch (seedError) {
    logCosmosError("cosmosGetSettings:seed-defaults", seedError)
  }
  return defaults
}

export async function cosmosSaveSettings(
  settings: AdminSettings
): Promise<AdminSettings> {
  const container = await getSettingsContainer()
  const doc = { ...settings, id: SETTINGS_DOC_ID }
  await container.items.upsert(doc)
  return settings
}

export async function cosmosGetProducts(): Promise<AdminProduct[]> {
  const { container, mode } = await resolveProductsContainer()
  const { resources } = await container.items
    .query<CosmosDoc<AdminProduct> & { docType?: string }>(productsQuerySql(mode))
    .fetchAll()

  if (resources.length > 0) {
    return resources
      .map((doc) => mapCosmosProductDoc(doc, mode))
      .filter((product): product is AdminProduct => product != null)
  }

  const seeded = seedProducts.map((p) => ({
    ...p,
    istAktiv: p.istAktiv !== false,
    galerieBilder: p.galerieBilder ?? p.images ?? [],
    modellDateiUrl: p.modellDateiUrl ?? p.modelUrl,
    updatedAt: new Date().toISOString(),
  }))

  for (const product of seeded) {
    await container.items.upsert(toProductCosmosDoc({ ...product, id: product.id }, mode))
  }
  return seeded
}

export async function cosmosSaveProducts(
  products: AdminProduct[]
): Promise<void> {
  const { container, mode } = await resolveProductsContainer()
  for (const product of products) {
    await container.items.upsert(toProductCosmosDoc({ ...product, id: product.id }, mode))
  }
}

function mapCosmosProductDoc(
  doc: (CosmosDoc<AdminProduct> & { docType?: string }) | null | undefined,
  _mode: "dedicated" | "shared"
): AdminProduct | null {
  if (!doc?.id) return null
  if (doc.id === SETTINGS_DOC_ID) return null
  if (doc.docType != null && doc.docType !== PRODUCT_DOC_TYPE) return null
  return {
    ...(stripCosmosId(doc) as Omit<AdminProduct, "id">),
    id: doc.id,
  }
}

export async function cosmosGetProductById(
  id: string
): Promise<AdminProduct | null> {
  const trimmed = id?.trim()
  if (!trimmed || trimmed === SETTINGS_DOC_ID) return null

  const { container, mode } = await resolveProductsContainer()

  try {
    const { resource } = await container
      .item(trimmed, trimmed)
      .read<CosmosDoc<AdminProduct> & { docType?: string }>()
    const mapped = mapCosmosProductDoc(resource, mode)
    if (mapped) return mapped
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      logCosmosError(`cosmosGetProductById:${trimmed}`, error)
      throw error
    }
  }

  if (mode === "shared") {
    const { resources } = await container.items
      .query<CosmosDoc<AdminProduct> & { docType?: string }>({
        query: `SELECT * FROM c WHERE c.id = @id AND c.docType = @docType`,
        parameters: [
          { name: "@id", value: trimmed },
          { name: "@docType", value: PRODUCT_DOC_TYPE },
        ],
      })
      .fetchAll()
    return mapCosmosProductDoc(resources[0], mode)
  }

  return null
}

export async function cosmosUpsertProduct(
  product: AdminProduct
): Promise<AdminProduct> {
  const { container, mode } = await resolveProductsContainer()
  const doc = toProductCosmosDoc({ ...product, id: product.id }, mode)
  await container.items.upsert(doc)
  return product
}

export async function cosmosDeleteProduct(id: string): Promise<boolean> {
  const { container } = await resolveProductsContainer()
  try {
    await container.item(id, id).delete()
    return true
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return false
    logCosmosError(`cosmosDeleteProduct:${id}`, error)
    throw error
  }
}
