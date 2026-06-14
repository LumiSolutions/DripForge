import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  normalizeProductTag,
  PRODUCT_TAG_DOC_TYPE,
  type ProductTag,
} from "@/lib/admin/product-tags"

type ProductTagCosmosDoc = ProductTag & { docType: string }

function mapProductTagDoc(
  doc: (ProductTagCosmosDoc & { id?: string }) | null | undefined
): ProductTag | null {
  if (!doc?.id || doc.docType !== PRODUCT_TAG_DOC_TYPE) return null
  return normalizeProductTag(doc)
}

export async function cosmosGetProductTags(): Promise<ProductTag[]> {
  const container = await getSettingsContainer()
  const { resources } = await container.items
    .query<ProductTagCosmosDoc>({
      query: `SELECT * FROM c WHERE c.docType = @docType ORDER BY c.sortOrder ASC, c.name ASC`,
      parameters: [{ name: "@docType", value: PRODUCT_TAG_DOC_TYPE }],
    })
    .fetchAll()

  return resources
    .map((doc) => mapProductTagDoc(doc))
    .filter((tag): tag is ProductTag => tag != null)
}

export async function cosmosGetProductTagById(id: string): Promise<ProductTag | null> {
  const trimmed = id?.trim()
  if (!trimmed) return null

  const container = await getSettingsContainer()
  try {
    const { resource } = await container.item(trimmed, trimmed).read<ProductTagCosmosDoc>()
    return mapProductTagDoc(resource)
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetProductTagById:${trimmed}`, error)
    throw error
  }
}

export async function cosmosUpsertProductTag(tag: ProductTag): Promise<ProductTag> {
  const container = await getSettingsContainer()
  const doc: ProductTagCosmosDoc = { ...tag, docType: PRODUCT_TAG_DOC_TYPE }
  await container.items.upsert(doc)
  return tag
}

export async function cosmosDeleteProductTag(id: string): Promise<boolean> {
  const trimmed = id?.trim()
  if (!trimmed) return false

  const container = await getSettingsContainer()
  try {
    await container.item(trimmed, trimmed).delete()
    return true
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return false
    logCosmosError(`cosmosDeleteProductTag:${trimmed}`, error)
    throw error
  }
}
