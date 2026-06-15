import { resolveProductsContainer } from "@/lib/cosmos/products-container"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  normalizeProductTag,
  PRODUCT_TAG_DOC_TYPE,
  type ProductTag,
} from "@/lib/admin/product-tags"

type ProductTagCosmosDoc = ProductTag & { docType: string }

function sortProductTags(tags: ProductTag[]): ProductTag[] {
  return [...tags].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")
  )
}

function mapProductTagDoc(
  doc: (ProductTagCosmosDoc & { id?: string }) | null | undefined
): ProductTag | null {
  if (!doc?.id || doc.docType !== PRODUCT_TAG_DOC_TYPE) return null
  return normalizeProductTag(doc)
}

async function queryProductTagsFromContainer(
  container: Awaited<ReturnType<typeof resolveProductsContainer>>["container"]
): Promise<ProductTag[]> {
  const { resources } = await container.items
    .query<ProductTagCosmosDoc>({
      query: `SELECT * FROM c WHERE c.docType = @docType`,
      parameters: [{ name: "@docType", value: PRODUCT_TAG_DOC_TYPE }],
    })
    .fetchAll()

  return sortProductTags(
    resources
      .map((doc) => mapProductTagDoc(doc))
      .filter((tag): tag is ProductTag => tag != null)
  )
}

/** Liest verwaiste Tags aus dem settings-Container (Legacy) und migriert sie. */
async function migrateLegacySettingsTags(
  targetContainer: Awaited<ReturnType<typeof resolveProductsContainer>>["container"]
): Promise<ProductTag[]> {
  try {
    const { getSettingsContainer } = await import("@/lib/cosmos/client")
    const settings = await getSettingsContainer()
    const { resources } = await settings.items
      .query<ProductTagCosmosDoc>({
        query: `SELECT * FROM c WHERE c.docType = @docType`,
        parameters: [{ name: "@docType", value: PRODUCT_TAG_DOC_TYPE }],
      })
      .fetchAll()

    const legacy = sortProductTags(
      resources
        .map((doc) => mapProductTagDoc(doc))
        .filter((tag): tag is ProductTag => tag != null)
    )

    if (legacy.length === 0) return []

    for (const tag of legacy) {
      const doc: ProductTagCosmosDoc = { ...tag, docType: PRODUCT_TAG_DOC_TYPE }
      await targetContainer.items.upsert(doc)
    }

    console.info(
      `Cosmos DB: ${legacy.length} Produkt-Tag(s) von 'settings' in den Produkte-Container migriert.`
    )
    return legacy
  } catch (error) {
    logCosmosError("migrateLegacySettingsTags", error)
    return []
  }
}

export async function cosmosGetProductTags(): Promise<ProductTag[]> {
  const { container } = await resolveProductsContainer()
  const tags = await queryProductTagsFromContainer(container)
  if (tags.length > 0) return tags

  return migrateLegacySettingsTags(container)
}

export async function cosmosGetProductTagById(id: string): Promise<ProductTag | null> {
  const trimmed = id?.trim()
  if (!trimmed) return null

  const { container } = await resolveProductsContainer()

  try {
    const { resource } = await container
      .item(trimmed, trimmed)
      .read<ProductTagCosmosDoc>()
    const mapped = mapProductTagDoc(resource)
    if (mapped) return mapped
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      logCosmosError(`cosmosGetProductTagById:${trimmed}`, error)
      throw error
    }
  }

  const { resources } = await container.items
    .query<ProductTagCosmosDoc>({
      query: `SELECT * FROM c WHERE c.id = @id AND c.docType = @docType`,
      parameters: [
        { name: "@id", value: trimmed },
        { name: "@docType", value: PRODUCT_TAG_DOC_TYPE },
      ],
    })
    .fetchAll()

  return mapProductTagDoc(resources[0])
}

export async function cosmosUpsertProductTag(tag: ProductTag): Promise<ProductTag> {
  const { container } = await resolveProductsContainer()
  const normalized = normalizeProductTag(tag)
  const doc: ProductTagCosmosDoc = { ...normalized, docType: PRODUCT_TAG_DOC_TYPE }
  await container.items.upsert(doc)
  return normalized
}

export async function cosmosDeleteProductTag(id: string): Promise<boolean> {
  const trimmed = id?.trim()
  if (!trimmed) return false

  const { container } = await resolveProductsContainer()
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
