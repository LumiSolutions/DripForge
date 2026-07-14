import {
  getSettingsContainer,
  isCosmosConfigured,
} from "@/lib/cosmos/client"
import {
  CUSTOMER_DOC_TYPE,
  customersQuerySql,
  resolveCustomersContainer,
  toCustomerCosmosDoc,
} from "@/lib/cosmos/customers-container"
import {
  ORDER_DOC_TYPE,
  ordersQuerySql,
  resolveOrdersContainer,
  toOrderCosmosDoc,
} from "@/lib/cosmos/orders-container"
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
  normalizeEnableOnboardingTour,
  normalizeOnboardingTourText,
  normalizeThemeInboundTourImageUrl,
  DEFAULT_ONBOARDING_TOUR_TEXT,
} from "@/lib/dripforge/theme-inbound-tour-settings"
import { normalizeLaunchSettings } from "@/lib/dripforge/countdown-settings"
import { normalizeEnableRewardPointsSystem } from "@/lib/dripforge/reward-points-settings"
import {
  buildCustomerFromOrder,
  mergeOrderIntoCustomer,
  normalizeCustomerEmail,
} from "@/lib/admin/customers"
import { allocateNextCustomerNumber } from "@/lib/admin/customer-number-service"
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

type CosmosDoc<T> = T & { id: string; docType?: string }

function stripCosmosId<T extends { id?: string; docType?: string }>(
  doc: T
): Omit<T, "id" | "docType"> {
  const { id: _id, docType: _docType, ...rest } = doc
  return rest
}

function isOrderDoc(doc: CosmosDoc<StoredOrder> | null | undefined): boolean {
  if (!doc?.id && !doc?.orderId) return false
  if (doc.docType != null && doc.docType !== ORDER_DOC_TYPE) return false
  return Boolean(doc.orderId || doc.items)
}

function isCustomerDoc(doc: CosmosDoc<StoredCustomer> | null | undefined): boolean {
  if (!doc) return false
  if (doc.docType != null && doc.docType !== CUSTOMER_DOC_TYPE) return false
  return Boolean(doc.kundennummer || doc.email)
}

export async function cosmosSaveOrder(order: StoredOrder): Promise<void> {
  const { container, mode } = await resolveOrdersContainer()
  await container.items.upsert(
    toOrderCosmosDoc({ ...order, id: order.orderId }, mode)
  )
}

export async function cosmosGetOrders(): Promise<StoredOrder[]> {
  const { container, mode } = await resolveOrdersContainer()
  const { resources } = await container.items
    .query<CosmosDoc<StoredOrder>>(ordersQuerySql(mode))
    .fetchAll()
  return resources
    .filter(isOrderDoc)
    .map((doc) => stripCosmosId(doc) as StoredOrder)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export async function cosmosGetOrderById(
  orderId: string
): Promise<StoredOrder | null> {
  const { container, mode } = await resolveOrdersContainer()
  try {
    const { resource } = await container
      .item(orderId, orderId)
      .read<CosmosDoc<StoredOrder>>()
    if (!resource || !isOrderDoc(resource)) return null
    if (mode === "shared" && resource.docType !== ORDER_DOC_TYPE) return null
    return stripCosmosId(resource) as StoredOrder
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetOrderById:${orderId}`, error)
    throw error
  }
}

export async function cosmosDeleteOrder(orderId: string): Promise<boolean> {
  const trimmed = orderId.trim()
  if (!trimmed) return false

  const existing = await cosmosGetOrderById(trimmed)
  if (!existing) return false

  const { container } = await resolveOrdersContainer()
  try {
    await container.item(trimmed, trimmed).delete()
    return true
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return false
    logCosmosError(`cosmosDeleteOrder:${trimmed}`, error)
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

export async function cosmosUpdateOrderShipment(
  orderId: string,
  data: Partial<Pick<StoredOrder, "productionStatus" | "trackingNumber" | "status">>
): Promise<StoredOrder | null> {
  const order = await cosmosGetOrderById(orderId)
  if (!order) return null
  const next = { ...order, ...data }
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

export async function cosmosUpdateOrderEmailNotifications(
  orderId: string,
  patch: Partial<NonNullable<StoredOrder["emailNotifications"]>>
): Promise<StoredOrder | null> {
  const order = await cosmosGetOrderById(orderId)
  if (!order) return null
  const next = {
    ...order,
    emailNotifications: {
      ...order.emailNotifications,
      ...patch,
    },
  }
  await cosmosSaveOrder(next)
  return next
}

export async function cosmosGetCustomers(): Promise<StoredCustomer[]> {
  const { container, mode } = await resolveCustomersContainer()
  const { resources } = await container.items
    .query<CosmosDoc<StoredCustomer>>(customersQuerySql(mode))
    .fetchAll()
  return resources
    .filter(isCustomerDoc)
    .map((doc) => stripCosmosId(doc) as StoredCustomer)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function cosmosGetCustomerByNumber(
  kundennummer: string
): Promise<StoredCustomer | null> {
  const { container, mode } = await resolveCustomersContainer()
  try {
    const { resource } = await container
      .item(kundennummer, kundennummer)
      .read<CosmosDoc<StoredCustomer>>()
    if (!resource || !isCustomerDoc(resource)) return null
    if (mode === "shared" && resource.docType !== CUSTOMER_DOC_TYPE) return null
    return stripCosmosId(resource) as StoredCustomer
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    console.error("Cosmos: Kunde konnte nicht gelesen werden.", kundennummer, error)
    throw error
  }
}

export async function cosmosGetCustomerByEmail(
  email: string
): Promise<StoredCustomer | null> {
  const normalized = normalizeCustomerEmail(email)
  if (!normalized) return null

  const { container, mode } = await resolveCustomersContainer()
  const { resources } = await container.items
    .query<CosmosDoc<StoredCustomer>>({
      query:
        mode === "shared"
          ? "SELECT * FROM c WHERE c.docType = @docType AND LOWER(c.email) = @email"
          : "SELECT * FROM c WHERE LOWER(c.email) = @email",
      parameters:
        mode === "shared"
          ? [
              { name: "@docType", value: CUSTOMER_DOC_TYPE },
              { name: "@email", value: normalized },
            ]
          : [{ name: "@email", value: normalized }],
    })
    .fetchAll()

  const match = resources
    .filter(isCustomerDoc)
    .find((doc) => normalizeCustomerEmail(doc.email) === normalized)
  return match ? (stripCosmosId(match) as StoredCustomer) : null
}

export async function cosmosUpsertCustomerFromOrder(
  order: StoredOrder
): Promise<StoredCustomer> {
  const { container, mode } = await resolveCustomersContainer()
  const existing = await cosmosGetCustomerByEmail(order.billing.email)

  let customer: StoredCustomer

  if (existing) {
    customer = mergeOrderIntoCustomer(existing, order)
  } else {
    customer = buildCustomerFromOrder(
      order,
      await allocateNextCustomerNumber()
    )
  }

  await container.items.upsert(
    toCustomerCosmosDoc({ ...customer, id: customer.kundennummer }, mode)
  )

  const orderWithCustomer = await cosmosGetOrderById(order.orderId)
  if (orderWithCustomer && orderWithCustomer.kundennummer !== customer.kundennummer) {
    await cosmosSaveOrder({ ...orderWithCustomer, kundennummer: customer.kundennummer })
  }

  return customer
}

export async function cosmosSaveCustomer(
  customer: StoredCustomer
): Promise<StoredCustomer> {
  const { container, mode } = await resolveCustomersContainer()
  const existing = await cosmosGetCustomerByNumber(customer.kundennummer)
  if (
    existing &&
    normalizeCustomerEmail(existing.email) !== normalizeCustomerEmail(customer.email)
  ) {
    throw new Error(`Kundennummer ${customer.kundennummer} ist bereits vergeben.`)
  }
  await container.items.upsert(
    toCustomerCosmosDoc({ ...customer, id: customer.kundennummer }, mode)
  )
  return customer
}

/** CRM-Eintrag mit neuer Kundennummer (z. B. Legacy KD-* → YY-#####). */
export async function cosmosReplaceCustomerRecord(
  customer: StoredCustomer,
  previousKundennummer?: string
): Promise<StoredCustomer> {
  const { container } = await resolveCustomersContainer()
  const previous = previousKundennummer?.trim()

  if (previous && previous !== customer.kundennummer) {
    try {
      await container.item(previous, previous).delete()
    } catch (error) {
      const code = (error as { code?: number }).code
      if (code !== 404) {
        logCosmosError(`cosmosReplaceCustomerRecord:delete:${previous}`, error)
        throw error
      }
    }
  }

  return cosmosSaveCustomer(customer)
}

export async function cosmosDeleteCustomer(kundennummer: string): Promise<boolean> {
  const trimmed = kundennummer.trim()
  if (!trimmed) return false

  const { container } = await resolveCustomersContainer()
  try {
    await container.item(trimmed, trimmed).delete()
    return true
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return false
    logCosmosError(`cosmosDeleteCustomer:${trimmed}`, error)
    throw error
  }
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
        launch: normalizeLaunchSettings(resource.launch),
        services,
        shopConfigurators: normalizeShopConfigurators(
          resource.shopConfigurators,
          services
        ),
        ...buildSupportPageSettings(resource),
        enableOnboardingTour: normalizeEnableOnboardingTour(
          resource.enableOnboardingTour ??
            (resource as { enableThemeInboundTour?: boolean }).enableThemeInboundTour
        ),
        onboardingTourText: normalizeOnboardingTourText(resource.onboardingTourText),
        themeInboundTourImageUrl: normalizeThemeInboundTourImageUrl(
          resource.themeInboundTourImageUrl
        ),
        enableRewardPointsSystem: normalizeEnableRewardPointsSystem(
          resource.enableRewardPointsSystem
        ),
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
    enableOnboardingTour: true,
    onboardingTourText: DEFAULT_ONBOARDING_TOUR_TEXT,
    themeInboundTourImageUrl: null,
    enableRewardPointsSystem: true,
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
