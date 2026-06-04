import { getCustomerDesignsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import type { SavedCustomerDesign } from "@/lib/konto/account-types"

type CosmosDoc<T> = T & { id: string }

export async function cosmosGetDesignsByEmail(
  email: string
): Promise<SavedCustomerDesign[]> {
  const customerEmail = normalizeCustomerEmail(email)
  const container = await getCustomerDesignsContainer()
  const { resources } = await container.items
    .query<CosmosDoc<SavedCustomerDesign>>({
      query: "SELECT * FROM c WHERE c.customerEmail = @email ORDER BY c.updatedAt DESC",
      parameters: [{ name: "@email", value: customerEmail }],
    })
    .fetchAll()

  return resources.map((doc) => ({
    id: doc.id,
    customerEmail: doc.customerEmail,
    label: doc.label,
    designType: doc.designType,
    previewUrl: doc.previewUrl ?? null,
    config: doc.config ?? {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }))
}

export async function cosmosUpsertDesign(
  design: SavedCustomerDesign
): Promise<SavedCustomerDesign> {
  const container = await getCustomerDesignsContainer()
  await container.items.upsert({ ...design, id: design.id })
  return design
}

export async function cosmosGetDesignById(
  email: string,
  designId: string
): Promise<SavedCustomerDesign | null> {
  const customerEmail = normalizeCustomerEmail(email)
  const container = await getCustomerDesignsContainer()
  try {
    const { resource: doc } = await container
      .item(designId, customerEmail)
      .read<CosmosDoc<SavedCustomerDesign>>()
    if (!doc || doc.customerEmail !== customerEmail) return null
    return {
      id: doc.id,
      customerEmail: doc.customerEmail,
      label: doc.label,
      designType: doc.designType,
      previewUrl: doc.previewUrl ?? null,
      config: doc.config ?? {},
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetDesignById:${designId}`, error)
    throw error
  }
}
