import {
  getCustomersContainer,
  getOrdersContainer,
  getProductsContainer,
  getSettingsContainer,
  isCosmosConfigured,
} from "@/lib/cosmos/client"
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
  StoredCustomer,
  StoredOrder,
} from "@/lib/admin/types"
import { DEFAULT_COMPANY_SETTINGS as DEFAULT_COMPANY } from "@/lib/admin/types"
import { DEFAULT_LAUNCH_SETTINGS } from "@/lib/admin/types"

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
    console.error("Cosmos: Bestellung konnte nicht gelesen werden.", orderId, error)
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
    customer = buildCustomerFromOrder(
      order,
      generateCustomerNumber(customers)
    )
  }

  await container.items.upsert({ ...customer, id: customer.kundennummer })

  const orderWithCustomer = await cosmosGetOrderById(order.orderId)
  if (orderWithCustomer && orderWithCustomer.kundennummer !== customer.kundennummer) {
    await cosmosSaveOrder({ ...orderWithCustomer, kundennummer: customer.kundennummer })
  }

  return customer
}

export async function cosmosGetSettings(): Promise<AdminSettings> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(SETTINGS_DOC_ID, SETTINGS_DOC_ID)
      .read<AdminSettings & { id: string }>()
    if (resource?.checkout) {
      return {
        checkout: resource.checkout,
        company: { ...DEFAULT_COMPANY, ...resource.company },
        launch: { ...DEFAULT_LAUNCH_SETTINGS, ...resource.launch },
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
    updatedAt: new Date().toISOString(),
  }
  await cosmosSaveSettings(defaults)
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
  const container = await getProductsContainer()
  const { resources } = await container.items
    .query<CosmosDoc<AdminProduct>>("SELECT * FROM c")
    .fetchAll()

  if (resources.length > 0) {
    return resources.map((doc) => stripCosmosId(doc) as AdminProduct)
  }

  const seeded = seedProducts.map((p) => ({
    ...p,
    istAktiv: p.istAktiv !== false,
    galerieBilder: p.galerieBilder ?? p.images ?? [],
    modellDateiUrl: p.modellDateiUrl ?? p.modelUrl,
    updatedAt: new Date().toISOString(),
  }))

  for (const product of seeded) {
    await container.items.upsert({ ...product, id: product.id })
  }
  return seeded
}

export async function cosmosSaveProducts(
  products: AdminProduct[]
): Promise<void> {
  const container = await getProductsContainer()
  for (const product of products) {
    await container.items.upsert({ ...product, id: product.id })
  }
}
